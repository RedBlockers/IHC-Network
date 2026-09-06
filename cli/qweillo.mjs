#!/usr/bin/env node

import { execFileSync, spawn } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, watch } from "node:fs";
import { homedir } from "node:os";
import { extname, join, relative } from "node:path";
import { createInterface } from "node:readline";

const usage = `qweillo — client en ligne de commande

  qweillo login    --url <https://app.exemple.tld> --token <qwp_…>
  qweillo whoami

  qweillo worktree status   --channel <id>
  qweillo worktree push     --channel <id> --name <nom> [--base <branche>] [--watch]
  qweillo worktree pipeline --channel <id> --name <nom> --pipeline <job> --status <queued|running|passed|failed> [--log <texte>]
  qweillo worktree review   --channel <id> --name <nom> --title <titre>
  qweillo worktree decide   --channel <id> --name <nom> --title <titre> --body <motif>
  qweillo worktree cursor   --channel <id> --name <nom> --file <chemin> [--line <n>]
  qweillo worktree terminal --channel <id> --name <nom> [--shell <programme>]

Le jeton se crée dans Paramètres du compte › Sécurité › Jetons d'accès.
Il est stocké dans ~/.config/qweillo/credentials (droits 0600).`;

const configDir = join(homedir(), ".config", "qweillo");
const credPath = join(configDir, "credentials");
const PATCH_LIMIT = 200_000;
const IGNORED_DIRS = new Set([".git", "node_modules", "dist", "build", "coverage", ".cache"]);

const LANGUAGES = {
    ".js": "javascript",
    ".mjs": "javascript",
    ".cjs": "javascript",
    ".jsx": "javascript",
    ".ts": "typescript",
    ".tsx": "typescript",
    ".py": "python",
    ".rs": "rust",
    ".go": "go",
    ".java": "java",
    ".kt": "kotlin",
    ".rb": "ruby",
    ".php": "php",
    ".sh": "shell",
    ".md": "markdown",
    ".json": "json",
    ".yml": "yaml",
    ".yaml": "yaml",
    ".css": "css",
    ".html": "html",
    ".sql": "sql",
};

function git(args, { allowFail = false } = {}) {
    try {
        return execFileSync("git", args, {
            cwd: process.cwd(),
            encoding: "utf8",
            stdio: ["ignore", "pipe", "ignore"],
        }).trim();
    } catch (error) {
        if (allowFail) return String(error.stdout ?? "").trim();
        throw new Error(`git ${args[0]} a échoué : lancez la commande depuis un dépôt Git.`);
    }
}

function loadCreds() {
    let raw;
    try {
        raw = JSON.parse(readFileSync(credPath, "utf8"));
    } catch {
        throw new Error("Aucun identifiant. Lancez d'abord : qweillo login --url <adresse> --token <jeton>");
    }
    if (!raw.url || !raw.token) throw new Error("Identifiants incomplets. Relancez qweillo login.");
    return raw;
}

async function api(path, { method = "GET", body } = {}) {
    const creds = loadCreds();
    let response;
    try {
        response = await fetch(`${creds.url.replace(/\/$/, "")}/api/v1${path}`, {
            method,
            headers: {
                Authorization: `Bearer ${creds.token}`,
                "Content-Type": "application/json",
            },
            body: body ? JSON.stringify(body) : undefined,
        });
    } catch {
        throw new Error(`Serveur injoignable : ${creds.url}`);
    }
    if (response.status === 204) return null;
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload?.error?.message || `HTTP ${response.status}`);
    return payload;
}

function parseArgs(argv) {
    const out = { _: [] };
    for (let index = 0; index < argv.length; index += 1) {
        const item = argv[index];
        if (item.startsWith("--")) {
            const next = argv[index + 1];
            if (next === undefined || next.startsWith("--")) {
                out[item.slice(2)] = true;
            } else {
                out[item.slice(2)] = next;
                index += 1;
            }
        } else out._.push(item);
    }
    return out;
}

function statusToKind(code) {
    if (code.startsWith("A") || code.endsWith("A") || code.includes("?")) return "added";
    if (code.includes("D")) return "deleted";
    if (code.trim() === "") return "clean";
    return "modified";
}

function filePatch(path) {
    const tracked = git(["diff", "HEAD", "--", path], { allowFail: true });
    if (tracked) return tracked.slice(0, PATCH_LIMIT);
    const cached = git(["diff", "--cached", "--", path], { allowFail: true });
    if (cached) return cached.slice(0, PATCH_LIMIT);
    const untracked = git(["diff", "--no-index", "--", "/dev/null", path], { allowFail: true });
    return untracked ? untracked.slice(0, PATCH_LIMIT) : null;
}

function requireChannel(args) {
    if (!args.channel) throw new Error("cette commande exige --channel <id>.");
    return String(args.channel);
}

async function resolveWorktree(args, { baseBranch, headBranch } = {}) {
    const channelId = requireChannel(args);
    const name = args.name;
    if (!name) throw new Error("cette commande exige --name <nom>.");
    const board = await api(`/channels/${channelId}/worktrees`);
    let tree = (board.worktrees ?? []).find((item) => item.name === name);
    if (!tree) {
        const created = await api(`/channels/${channelId}/worktrees`, {
            method: "POST",
            body: { name, baseBranch: baseBranch || "main", headBranch: headBranch || baseBranch || "main" },
        });
        tree = created.worktree;
    } else {
        const joined = await api(`/channels/${channelId}/worktrees/${tree.worktreeId}/join`, { method: "POST" });
        tree = joined.worktree ?? tree;
    }
    return { channelId, tree };
}

function snapshotFromGit() {
    const headSha = git(["rev-parse", "HEAD"]);
    const headBranch = git(["rev-parse", "--abbrev-ref", "HEAD"]);
    const porcelain = git(["status", "--porcelain"]);
    const files = porcelain
        ? porcelain
              .split("\n")
              .filter(Boolean)
              .map((line) => {
                  const path = line.slice(3);
                  return {
                      path,
                      status: statusToKind(line.slice(0, 2)),
                      language: LANGUAGES[extname(path)] ?? null,
                      patch: filePatch(path),
                  };
              })
        : [];
    const log = git(["log", "-10", "--format=%H\t%s\t%an\t%aI"], { allowFail: true });
    const commits = log
        ? log.split("\n").map((line) => {
              const [sha, subject, authorHandle, committedAt] = line.split("\t");
              return { sha, subject, authorHandle, committedAt };
          })
        : [];
    return { headSha, headBranch, files, commits };
}

async function pushOnce(args) {
    const { headSha, headBranch, files, commits } = snapshotFromGit();
    const baseBranch = args.base || "main";
    const { channelId, tree } = await resolveWorktree(args, { baseBranch, headBranch });
    const updated = await api(`/channels/${channelId}/worktrees/${tree.worktreeId}/snapshot`, {
        method: "PUT",
        body: { headBranch, baseBranch, headSha, files, commits },
    });
    const stamp = new Date().toLocaleTimeString("fr-FR");
    process.stdout.write(
        `${stamp}  ${updated.worktree.name} @ ${headSha.slice(0, 7)} · ${files.length} fichier(s) modifié(s)\n`
    );
}

async function pushWorktree(args) {
    await pushOnce(args);
    if (!args.watch) return;
    process.stdout.write("Surveillance du dépôt : chaque changement est poussé (Ctrl-C pour arrêter).\n");
    let timer = null;
    let busy = false;
    const schedule = () => {
        clearTimeout(timer);
        timer = setTimeout(async () => {
            if (busy) return schedule();
            busy = true;
            try {
                await pushOnce(args);
            } catch (error) {
                process.stderr.write(`${error.message}\n`);
            } finally {
                busy = false;
            }
        }, 1500);
    };
    watch(process.cwd(), { recursive: true }, (_event, filename) => {
        const first = String(filename ?? "").split(/[\\/]/)[0];
        if (IGNORED_DIRS.has(first)) return;
        schedule();
    });
    await new Promise(() => {});
}

async function showStatus(args) {
    const channelId = requireChannel(args);
    const board = await api(`/channels/${channelId}/worktrees`);
    const trees = board.worktrees ?? [];
    if (trees.length === 0) {
        process.stdout.write("Aucun worktree dans ce salon.\n");
        return;
    }
    for (const tree of trees) {
        const pipeline = tree.pipelines?.[0];
        const review = tree.reviews?.[0];
        const people = (tree.members ?? []).map((member) => member.handle).join(", ");
        process.stdout.write(
            `${tree.name.padEnd(24)} ${tree.baseBranch} → ${tree.headBranch}` +
                `${tree.headSha ? ` @ ${tree.headSha.slice(0, 7)}` : ""}` +
                `${tree.dirty ? "  [modifié]" : ""}` +
                `${pipeline ? `  pipeline ${pipeline.name}: ${pipeline.status}` : ""}` +
                `${review ? `  revue: ${review.status}` : ""}` +
                `  (${people || "personne"})\n`
        );
    }
}

async function reportPipeline(args) {
    const status = args.status;
    if (!args.pipeline || !status) throw new Error("pipeline exige --pipeline et --status.");
    const { channelId, tree } = await resolveWorktree(args);
    const updated = await api(`/channels/${channelId}/worktrees/${tree.worktreeId}/pipelines`, {
        method: "POST",
        body: { name: args.pipeline, status, logExcerpt: typeof args.log === "string" ? args.log : "" },
    });
    const last = updated.worktree.pipelines?.[0];
    process.stdout.write(`pipeline ${last?.name ?? args.pipeline} : ${last?.status ?? status}\n`);
}

async function openReview(args) {
    if (!args.title) throw new Error("review exige --title.");
    const { channelId, tree } = await resolveWorktree(args);
    const updated = await api(`/channels/${channelId}/worktrees/${tree.worktreeId}/reviews`, {
        method: "POST",
        body: {
            title: args.title,
            ...(tree.headSha ? { baseSha: tree.headSha, headSha: tree.headSha } : {}),
        },
    });
    const review = updated.worktree.reviews?.[0];
    process.stdout.write(`revue ouverte : ${review?.title ?? args.title} (${review?.status ?? "open"})\n`);
}

async function decide(args) {
    if (!args.title || !args.body) throw new Error("decide exige --title et --body.");
    const { channelId, tree } = await resolveWorktree(args);
    await api(`/channels/${channelId}/worktrees/${tree.worktreeId}/decisions`, {
        method: "POST",
        body: { title: args.title, body: args.body },
    });
    process.stdout.write(`décision consignée : ${args.title}\n`);
}

async function moveCursor(args) {
    if (!args.file) throw new Error("cursor exige --file.");
    const { channelId, tree } = await resolveWorktree(args);
    const path = relative(process.cwd(), args.file) || args.file;
    await api(`/channels/${channelId}/worktrees/${tree.worktreeId}/cursor`, {
        method: "PUT",
        body: { path, line: Number(args.line) || 1, column: 0 },
    });
    process.stdout.write(`curseur : ${path}:${Number(args.line) || 1}\n`);
}

async function sharedTerminal(args) {
    const { channelId, tree } = await resolveWorktree(args);
    const me = (await api("/auth/me")).user;
    const base = `/channels/${channelId}/worktrees/${tree.worktreeId}/terminal`;
    const opened = await api(base, { method: "POST" });
    const session = (opened.worktree.terminals ?? []).find((item) => item.status === "open");
    if (!session) throw new Error("Le serveur n'a pas ouvert de session de terminal.");

    const shellProgram = typeof args.shell === "string" ? args.shell : process.env.SHELL || "/bin/sh";
    process.stdout.write(
        `Terminal partagé ouvert (session ${session.sessionId}) sur ${shellProgram}.\n` +
            `Les membres de « ${tree.name} » voient cette sortie et peuvent envoyer des commandes qui s'exécutent ici.\n` +
            "Ctrl-C ferme la session.\n\n"
    );

    const shell = spawn(shellProgram, [], {
        cwd: process.cwd(),
        env: { ...process.env, TERM: "dumb", PS1: "" },
        stdio: ["pipe", "pipe", "pipe"],
    });

    let outBuffer = "";
    let flushTimer = null;
    let closed = false;
    let lastChunkId = 0;
    const send = (data, direction) =>
        api(`${base}/${session.sessionId}`, { method: "POST", body: { data, direction } });

    const flush = async () => {
        if (!outBuffer) return;
        const data = outBuffer.slice(0, 4000);
        outBuffer = outBuffer.slice(4000);
        try {
            const chunk = await send(data, "output");
            lastChunkId = Math.max(lastChunkId, Number(chunk.chunkId) || 0);
        } catch (error) {
            process.stderr.write(`relais interrompu : ${error.message}\n`);
        }
        if (outBuffer) flush();
    };
    const onOutput = (data) => {
        process.stdout.write(data);
        outBuffer += data.toString();
        if (outBuffer.length >= 3500) flush();
        else {
            clearTimeout(flushTimer);
            flushTimer = setTimeout(flush, 150);
        }
    };
    shell.stdout.on("data", onOutput);
    shell.stderr.on("data", onOutput);

    const runCommand = async (line, origin) => {
        if (!line.trim()) return;
        if (origin) process.stdout.write(`[${origin}] $ ${line}\n`);
        shell.stdin.write(`${line}\n`);
    };

    const rl = createInterface({ input: process.stdin, terminal: false });
    rl.on("line", async (line) => {
        try {
            const chunk = await send(`${line}\n`, "input");
            lastChunkId = Math.max(lastChunkId, Number(chunk.chunkId) || 0);
        } catch (error) {
            process.stderr.write(`relais interrompu : ${error.message}\n`);
        }
        runCommand(line, null);
    });

    const poll = async () => {
        if (closed) return;
        try {
            const log = await api(`${base}/${session.sessionId}?after=${lastChunkId}&limit=100`);
            for (const chunk of log.chunks ?? []) {
                lastChunkId = Math.max(lastChunkId, Number(chunk.chunkId));
                if (chunk.direction !== "input" || Number(chunk.userId) === Number(me.userId)) continue;
                for (const line of chunk.data.split("\n")) await runCommand(line, chunk.handle);
            }
            if (log.status === "closed") {
                process.stdout.write("\nSession fermée depuis le salon.\n");
                shutdown(0);
                return;
            }
        } catch (error) {
            process.stderr.write(`lecture du salon interrompue : ${error.message}\n`);
        }
        setTimeout(poll, 700);
    };

    const shutdown = async (code) => {
        if (closed) return;
        closed = true;
        clearTimeout(flushTimer);
        await flush();
        try {
            await api(`${base}/${session.sessionId}`, { method: "DELETE" });
        } catch {}
        shell.kill();
        rl.close();
        process.exit(code);
    };

    shell.on("exit", (code) => shutdown(code ?? 0));
    process.on("SIGINT", () => shutdown(0));
    process.on("SIGTERM", () => shutdown(0));
    poll();
    await new Promise(() => {});
}

async function login(args) {
    if (!args.url || !args.token) throw new Error("login exige --url et --token.");
    if (!/^https?:\/\//.test(args.url)) throw new Error("--url doit commencer par http:// ou https://.");
    mkdirSync(configDir, { recursive: true, mode: 0o700 });
    writeFileSync(credPath, JSON.stringify({ url: args.url.replace(/\/$/, ""), token: args.token }, null, 2), {
        mode: 0o600,
    });
    const me = (await api("/auth/me")).user;
    process.stdout.write(`Connecté en tant que @${me.handle}. Identifiants écrits dans ${credPath}\n`);
}

async function whoami() {
    const me = (await api("/auth/me")).user;
    process.stdout.write(`@${me.handle} (${me.displayName}) sur ${loadCreds().url}\n`);
}

const args = parseArgs(process.argv.slice(2));
const [command, action] = args._;
const worktreeCommands = {
    status: showStatus,
    push: pushWorktree,
    pipeline: reportPipeline,
    review: openReview,
    decide,
    cursor: moveCursor,
    terminal: sharedTerminal,
};

try {
    if (command === "login") await login(args);
    else if (command === "whoami") await whoami();
    else if (command === "worktree" && worktreeCommands[action]) await worktreeCommands[action](args);
    else {
        process.stdout.write(`${usage}\n`);
        process.exit(command ? 1 : 0);
    }
} catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
}
