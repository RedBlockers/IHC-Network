import { generateKeyPairSync, randomBytes } from "node:crypto";
import { readFile, writeFile, mkdir, chmod } from "node:fs/promises";
import { lookup } from "node:dns/promises";
import { isIPv4 } from "node:net";
import { Terminal } from "./terminal.mjs";
import { parseArgs, parseEnv } from "node:util";
import { fileURLToPath } from "node:url";
import path from "node:path";

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let values;
try {
    ({ values } = parseArgs({
        options: {
            help: { type: "boolean" },
            yes: { type: "boolean" },
            url: { type: "string" },
            name: { type: "string" },
            "media-domain": { type: "string" },
            "node-ip": { type: "string" },
            "local-only": { type: "boolean" },
            action: { type: "string" },
            "external-proxy": { type: "boolean" },
        },
    }));
} catch (error) {
    process.stderr.write(`${error.message}\nConsultez ./qweillo --help pour les options disponibles.\n`);
    process.exit(1);
}
const help =
    "Usage : ./qweillo [--yes] [--name Nom] [--url URL]\nSans argument : assistant interactif au clavier. --yes : valeurs locales par défaut.\nActions : --action start|status|backup|stop\nPour Internet : --url https://chat.exemple.fr --media-domain media.exemple.fr\nAvec un proxy existant : ajouter --external-proxy.\n";
let terminal;
let action = values.action || "start";
let externalProxy = Boolean(values["external-proxy"]);

const encodeValue = (value) => JSON.stringify(value).split("$").join("$$");
const isLocal = (url) => ["localhost", "127.0.0.1"].includes(url.hostname) && url.protocol === "http:";
const validName = (value) => value.trim().length > 0 && value.length <= 80 && !/[\r\n\x00-\x1f\x7f]/.test(value);

function parseConfiguration(text) {
    const env = parseEnv(text);
    for (const match of text.matchAll(
        /^[ \t]*(?:export[ \t]+)?([A-Za-z_][A-Za-z0-9_]*)[ \t]*=[ \t]*("(?:\\.|[^"\\])*")/gm
    )) {
        try {
            env[match[1]] = JSON.parse(match[2]).replaceAll("$$", "$");
        } catch {}
    }
    return env;
}

function updateEntry(text, key, value) {
    const match = new RegExp(`^[ \\t]*(?:export[ \\t]+)?${key}[ \\t]*=`, "m").exec(text);
    if (!match) return `${text.replace(/\n?$/, "\n")}${key}=${encodeValue(value)}\n`;
    let end = match.index + match[0].length;
    while (text[end] === " " || text[end] === "\t") end++;
    const quote = text[end];
    if (quote === '"' || quote === "'") {
        end++;
        while (end < text.length && text[end] !== quote) end += text[end] === "\\" ? 2 : 1;
        if (end >= text.length) throw new Error("La configuration existante contient une valeur incomplète.");
        end++;
    } else {
        const newline = text.indexOf("\n", end);
        end = newline === -1 ? text.length : newline;
    }
    return `${text.slice(0, match.index)}${key}=${encodeValue(value)}${text.slice(end)}`;
}

function origin(value) {
    let url;
    try {
        url = new URL(value);
    } catch {
        throw new Error("Saisissez une adresse HTTP(S) valide avec un port entre 1 et 65535.");
    }
    if (url.port === "0") throw new Error("Choisissez un port entre 1 et 65535.");
    if (
        !["http:", "https:"].includes(url.protocol) ||
        url.username ||
        url.password ||
        url.search ||
        url.hash ||
        url.pathname !== "/"
    ) {
        throw new Error("L’adresse doit être une origine HTTP(S), sans chemin ni identifiants.");
    }
    return url;
}

async function ask(label, fallback) {
    if (!terminal) return fallback;
    return terminal.text(label, fallback);
}

async function recordStart(env) {
    const mode = env.APP_DOMAIN ? "production" : "local";
    if (!/^[A-Za-z0-9_-]+$/.test(env.LIVEKIT_API_KEY || ""))
        throw new Error("La clé API LiveKit est absente ou invalide.");
    const template = await readFile(path.join(project, "infra/livekit/livekit.local.yaml.template"), "utf8");
    await mkdir(path.join(project, "runtime"), { recursive: true });
    const localConfig = path.join(project, "runtime/livekit-local.yaml");
    await writeFile(localConfig, template.replace("${LIVEKIT_API_KEY}", env.LIVEKIT_API_KEY), { mode: 0o644 });
    await chmod(localConfig, 0o644);
    await mkdir(path.join(project, ".runtime"), { recursive: true, mode: 0o700 });
    await chmod(path.join(project, ".runtime"), 0o700);
    await writeFile(path.join(project, ".runtime/start-mode"), mode, { mode: 0o600 });
    await writeFile(
        path.join(project, ".runtime/start-proxy"),
        env.QWEILLO_EXTERNAL_PROXY === "1" ? "external" : "automatic",
        { mode: 0o600 }
    );
    await writeFile(path.join(project, ".runtime/action"), action, { mode: 0o600 });
    await writeFile(
        path.join(project, ".runtime/start-url"),
        origin(env.PUBLIC_URL || env.CORS_ORIGIN.split(",")[0]).origin,
        {
            mode: 0o600,
        }
    );
    if (mode === "production") {
        const data = path.resolve(project, env.QWEILLO_DATA_DIR || "runtime/data");
        for (const name of ["control", "uploads", "redis", "caddy-data", "caddy-config"]) {
            await mkdir(path.join(data, name), { recursive: true, mode: 0o755 });
        }
    }
}

try {
    if (values.help) process.stdout.write(help);
    else {
        if (!["start", "status", "backup", "stop"].includes(action))
            throw new Error("Action inconnue. Utilisez start, status, backup ou stop.");
        let existing;
        try {
            existing = await readFile(path.join(project, ".env"), "utf8");
        } catch (error) {
            if (error.code !== "ENOENT") throw error;
        }
        if (existing !== undefined) {
            const env = parseConfiguration(existing);
            let updated = existing;
            if (values["local-only"] && env.APP_DOMAIN)
                throw new Error("Cette installation Internet doit être gérée depuis son serveur Linux.");
            if (
                values.action &&
                values.action !== "start" &&
                ["name", "url", "media-domain", "node-ip", "external-proxy"].some((key) => values[key] !== undefined)
            )
                throw new Error("Les options de configuration s’utilisent avec le démarrage, sans action de gestion.");
            if (
                (values["media-domain"] && values["media-domain"] !== env.LIVEKIT_DOMAIN) ||
                (values["node-ip"] && values["node-ip"] !== env.LIVEKIT_NODE_IP) ||
                (values["external-proxy"] && env.QWEILLO_EXTERNAL_PROXY !== "1")
            )
                throw new Error(
                    "Ces options réseau décrivent une nouvelle installation. La configuration existante a été conservée ; modifiez ses paramètres réseau dans .env avant de relancer ./qweillo."
                );
            if (
                !values.yes &&
                !["action", "name", "url", "media-domain", "node-ip", "external-proxy"].some(
                    (key) => values[key] !== undefined
                ) &&
                process.stdin.isTTY
            ) {
                terminal = new Terminal();
                terminal.intro(true);
                process.stdout.write(`  ${env.INSTANCE_NAME || "Qweillo"} · ${env.PUBLIC_URL || env.CORS_ORIGIN}\n\n`);
                const choice = await terminal.select("Que souhaitez-vous faire ?", [
                    {
                        value: "start",
                        label: "Démarrer ou mettre à jour",
                        description: "Les données et les clés existantes sont conservées.",
                    },
                    {
                        value: "status",
                        label: "Voir l’état des services",
                        description: "Vérifier le serveur, la base de données et la voix.",
                    },
                    {
                        value: "backup",
                        label: "Créer une sauvegarde",
                        description: "Sauvegarder la base et les fichiers de cette instance.",
                    },
                    {
                        value: "email",
                        label: "Configurer l’envoi des e-mails",
                        description: "Activer la vérification des adresses et la récupération de compte.",
                    },
                    {
                        value: "configure",
                        label: "Modifier le nom de l’instance",
                        description: "Actualiser le nom affiché aux membres.",
                    },
                    {
                        value: "stop",
                        label: "Arrêter l’instance",
                        description: "Arrêter les services en conservant toutes les données.",
                    },
                    { value: "exit", label: "Quitter", description: "Ne rien modifier." },
                ]);
                action = ["email", "configure"].includes(choice) ? "start" : choice;
                if (choice === "configure")
                    values.name = await terminal.text("Nom de l’instance", env.INSTANCE_NAME || "Qweillo", {
                        validate: (value) => (validName(value) ? "" : "Le nom doit contenir entre 1 et 80 caractères."),
                    });
                if (choice === "email") {
                    const host = await ask("Serveur SMTP", env.SMTP_HOST || "");
                    if (!host) throw new Error("Le serveur SMTP est requis pour activer le courrier.");
                    let port = await terminal.select(
                        "Connexion au serveur de courrier",
                        [
                            {
                                value: "587",
                                label: "Port 587 · STARTTLS",
                                description: "Configuration habituelle d’un fournisseur de courrier.",
                            },
                            {
                                value: "465",
                                label: "Port 465 · TLS",
                                description: "Connexion chiffrée dès l’ouverture.",
                            },
                            {
                                value: "25",
                                label: "Port 25 · relais local",
                                description: "Réservé à un relais de courrier que vous gérez.",
                            },
                            {
                                value: "custom",
                                label: "Un autre port",
                                description: "Utiliser le port fourni par votre hébergeur de courrier.",
                            },
                        ],
                        Math.max(
                            0,
                            ["587", "465", "25", "custom"].indexOf(
                                ["587", "465", "25"].includes(env.SMTP_PORT) ? env.SMTP_PORT : "custom"
                            )
                        )
                    );
                    if (port === "custom")
                        port = await terminal.text("Port SMTP", env.SMTP_PORT || "587", {
                            validate: (value) =>
                                /^\d+$/.test(value) && Number(value) >= 1 && Number(value) <= 65535
                                    ? ""
                                    : "Choisissez un port entre 1 et 65535.",
                        });
                    const user = await ask("Identifiant SMTP (facultatif pour un relais local)", env.SMTP_USER || "");
                    const keepPassword = Boolean(env.SMTP_PASSWORD && env.SMTP_USER === user && env.SMTP_HOST === host);
                    const password = user
                        ? await terminal.text(
                              keepPassword ? "Mot de passe SMTP (vide pour conserver)" : "Mot de passe SMTP",
                              "",
                              {
                                  secret: true,
                                  validate: (value) =>
                                      value || keepPassword ? "" : "Le mot de passe de ce compte SMTP est requis.",
                              }
                          )
                        : "";
                    const from = await terminal.text("Adresse d’expédition", env.MAIL_FROM || "", {
                        validate: (value) => (/@/.test(value) ? "" : "Indiquez une adresse d’expédition valide."),
                    });
                    const mail = { SMTP_HOST: host, SMTP_PORT: port, SMTP_USER: user, MAIL_FROM: from };
                    if (password || !keepPassword) mail.SMTP_PASSWORD = password;
                    for (const [key, value] of Object.entries(mail)) updated = updateEntry(updated, key, value);
                }
                if (choice === "stop")
                    action = await terminal.select("Arrêter cette instance maintenant ?", [
                        {
                            value: "exit",
                            label: "Garder l’instance en marche",
                            description: "Retourner au terminal sans changer les services.",
                        },
                        {
                            value: "stop",
                            label: "Arrêter les services",
                            description: "Vous pourrez les redémarrer avec ./qweillo.",
                        },
                    ]);
            }
            if (values.name !== undefined) {
                if (!validName(values.name)) throw new Error("Le nom doit contenir entre 1 et 80 caractères.");
                updated = updateEntry(updated, "INSTANCE_NAME", values.name);
            }
            if (values.url) {
                const next = origin(values.url);
                const previous = origin(env.PUBLIC_URL || env.CORS_ORIGIN.split(",")[0]);
                if (next.origin !== previous.origin) {
                    if (env.APP_DOMAIN || !isLocal(next) || !isLocal(previous))
                        throw new Error(
                            "Pour créer un profil Internet, utilisez une installation distincte sur le serveur Linux. La configuration existante a été conservée."
                        );
                    for (const [key, value] of Object.entries({
                        PUBLIC_URL: next.origin,
                        CORS_ORIGIN: next.origin,
                        WEB_PORT: next.port || "80",
                        LIVEKIT_URL: `ws://${next.hostname}:7880`,
                    }))
                        updated = updateEntry(updated, key, value);
                }
            }
            if (updated !== existing) {
                await mkdir(path.join(project, ".runtime"), { recursive: true, mode: 0o700 });
                await writeFile(path.join(project, `.runtime/config-${Date.now()}.env`), existing, {
                    mode: 0o600,
                    flag: "wx",
                });
                await writeFile(path.join(project, ".env"), updated, { mode: 0o600 });
            }
            if (action !== "exit") await chmod(path.join(project, ".env"), 0o600);
            await recordStart(parseConfiguration(updated));
            process.stdout.write(
                updated === existing
                    ? "Configuration existante conservée.\n"
                    : "Configuration mise à jour. Les autres secrets et les données sont conservés.\n"
            );
        } else {
            if (!values.yes && process.stdin.isTTY) terminal = new Terminal();
            if (terminal) terminal.intro();
            else process.stdout.write("\nQweillo · installation du serveur\n\n");
            if (values.action && values.action !== "start")
                throw new Error("Aucune instance n’est installée dans ce dossier. Lancez ./qweillo pour commencer.");
            const name =
                values.name ??
                (terminal
                    ? await terminal.text("Nom de votre instance", "Mon Qweillo", {
                          validate: (value) =>
                              validName(value) ? "" : "Le nom doit contenir entre 1 et 80 caractères.",
                      })
                    : "Mon Qweillo");
            if (!validName(name)) throw new Error("Le nom doit contenir entre 1 et 80 caractères.");
            let publicUrl = values.url;
            if (!publicUrl) {
                const mode = values["local-only"]
                    ? "1"
                    : values["external-proxy"]
                      ? "3"
                      : !terminal
                        ? "1"
                        : await terminal.select("Où voulez-vous utiliser votre instance ?", [
                              {
                                  value: "1",
                                  label: "Sur cet ordinateur",
                                  description: "Essayer Qweillo avec la voix et la vidéo, sans domaine.",
                              },
                              {
                                  value: "2",
                                  label: "Sur Internet · HTTPS automatique",
                                  description: "Installer sur un serveur Linux avec vos noms de domaine.",
                              },
                              {
                                  value: "3",
                                  label: "Sur Internet · proxy existant",
                                  description: "Utiliser votre nginx, Caddy ou Traefik déjà installé.",
                              },
                          ]);
                externalProxy = mode === "3";
                publicUrl =
                    mode !== "1"
                        ? `https://${await ask("Domaine de l’application (DNS déjà configuré)", "")}`
                        : `http://localhost:${terminal ? await terminal.text("Port de l’instance", "8080", { validate: (value) => (/^\d+$/.test(value) && Number(value) >= 1 && Number(value) <= 65535 ? "" : "Choisissez un port entre 1 et 65535.") }) : "8080"}`;
            }
            const url = origin(publicUrl);
            const local = isLocal(url);
            if (local && (values["external-proxy"] || values["media-domain"] || values["node-ip"]))
                throw new Error("Les options de proxy et de média nécessitent une adresse Internet HTTPS.");
            const secret = (size = 32) => randomBytes(size).toString("base64url");
            const vapid = generateKeyPairSync("ec", { namedCurve: "prime256v1" }).privateKey.export({ format: "jwk" });
            const env = {
                INSTANCE_NAME: name,
                COMPOSE_PROJECT_NAME: `qweillo-${randomBytes(6).toString("hex")}`,
                JWT_SECRET: secret(48),
                DB_APP_PASSWORD: secret(),
                DB_ROOT_PASSWORD: secret(),
                CORS_ORIGIN: url.origin,
                PUBLIC_URL: url.origin,
                LIVEKIT_API_KEY: randomBytes(16).toString("hex"),
                LIVEKIT_API_SECRET: secret(48),
                BIND_IP: "127.0.0.1",
                WEB_PORT: local ? url.port || "80" : "8080",
                SMTP_HOST: "",
                SMTP_PORT: "587",
                SMTP_USER: "",
                SMTP_PASSWORD: "",
                MAIL_FROM: "",
                VAPID_PUBLIC_KEY: Buffer.concat([
                    Buffer.from([4]),
                    Buffer.from(vapid.x, "base64url"),
                    Buffer.from(vapid.y, "base64url"),
                ]).toString("base64url"),
                VAPID_PRIVATE_KEY: vapid.d,
                VAPID_SUBJECT: local ? "" : url.origin,
                QWEILLO_CONTROL_DIR: "./infra/control",
                QWEILLO_DATA_DIR: path.join(project, "runtime/data"),
                QWEILLO_EXTERNAL_PROXY: externalProxy ? "1" : "0",
            };
            if (local) {
                if (url.protocol !== "http:")
                    throw new Error(
                        "L’essai local utilise HTTP sur localhost ; HTTPS est activé automatiquement avec un domaine public."
                    );
                env.LIVEKIT_URL = `ws://${url.hostname}:7880`;
            } else {
                if (values["local-only"])
                    throw new Error(
                        "Le profil Internet utilise un serveur Linux. Utilisez localhost pour tester avec Docker Desktop."
                    );
                if (url.protocol !== "https:" || url.port)
                    throw new Error("L’accès Internet utilise un domaine HTTPS, sans port personnalisé.");
                const media =
                    values["media-domain"] || (await ask("Domaine du vocal et de la vidéo", `media.${url.hostname}`));
                if (
                    !media ||
                    media.length > 253 ||
                    !media.split(".").every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label)) ||
                    media.toLowerCase() === url.hostname ||
                    isIPv4(media)
                )
                    throw new Error("Le média doit avoir son propre nom de domaine.");
                let nodeIp = values["node-ip"];
                try {
                    nodeIp ||= (await lookup(url.hostname, { family: 4 })).address;
                } catch {
                    throw new Error(
                        "Le domaine n’a pas d’adresse IPv4. Faites pointer son enregistrement DNS A vers ce serveur, puis relancez ./qweillo."
                    );
                }
                if (!isIPv4(nodeIp)) throw new Error("L’adresse du serveur média doit être une IPv4 valide.");
                Object.assign(env, {
                    APP_DOMAIN: url.hostname,
                    LIVEKIT_DOMAIN: media,
                    LIVEKIT_URL: `wss://${media}`,
                    LIVEKIT_NODE_IP: nodeIp,
                    LIVEKIT_TURN_HOST: media,
                    LIVEKIT_TURN_PORT: "3478",
                    ACME_EMAIL: "",
                    REDIS_HOST_PORT: "6379",
                });
                process.stdout.write(
                    `\nDomaines : ${url.hostname} et ${media}\nIls doivent pointer vers ce serveur. Ports requis : 80/443 TCP, 443 UDP, 7881 TCP, 3478 et 50000–50200 UDP.\n`
                );
            }
            if (terminal) {
                terminal.summary([
                    ["Instance", name],
                    ["Adresse", url.origin],
                    ["Voix et vidéo", "Incluses · LiveKit"],
                    ["Données", "Conservées sur votre machine"],
                    ["Clés et secrets", "Générés automatiquement"],
                    [
                        "HTTPS",
                        local ? "Non requis sur localhost" : externalProxy ? "Géré par votre proxy" : "Automatique",
                    ],
                ]);
                const confirmed = await terminal.select("Lancer l’installation ?", [
                    {
                        value: true,
                        label: "Installer et démarrer Qweillo",
                        description: "La première construction peut prendre quelques minutes.",
                    },
                    {
                        value: false,
                        label: "Quitter sans installer",
                        description: "Aucun fichier de configuration ne sera créé.",
                    },
                ]);
                if (!confirmed) throw Object.assign(new Error("Installation annulée."), { code: "CANCELLED" });
            }
            await mkdir(path.join(project, "infra/control"), { recursive: true });
            await writeFile(
                path.join(project, ".env"),
                Object.entries(env)
                    .map(([key, value]) => `${key}=${encodeValue(value)}`)
                    .join("\n") + "\n",
                { mode: 0o600, flag: "wx" }
            );
            await recordStart(env);
            process.stdout.write(
                "\nConfiguration prête. Les secrets ont été générés et enregistrés dans .env.\nLes clés de chiffrement sont créées automatiquement sur vos appareils.\nLes e-mails restent facultatifs : voir docs/self-hosting.md pour activer le courrier.\n"
            );
        }
    }
} catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = error.code === "CANCELLED" ? 130 : 1;
} finally {
    terminal?.close();
}
