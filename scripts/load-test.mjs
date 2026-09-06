import { randomUUID } from "node:crypto";

const args = Object.fromEntries(
    process.argv.slice(2).reduce((pairs, value, index, all) => {
        if (value.startsWith("--")) pairs.push([value.slice(2), all[index + 1]]);
        return pairs;
    }, [])
);

const BASE = args.base ?? "http://localhost:8080";
const API = `${BASE}/api/v1`;
const STEPS = (args.paliers ?? "5,15,40,80").split(",").map(Number);
const SECONDS = Number(args.secondes ?? 12);
const HANDLES = (args.comptes ?? "ada,alan").split(",");
const PASSWORD = args.motdepasse ?? "password123";

const percentile = (sorted, part) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * part))] ?? 0;

async function login(handle) {
    const response = await fetch(`${API}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle, password: PASSWORD }),
    });
    if (response.status === 429) return null;
    if (!response.ok) throw new Error(`connexion refusée pour ${handle} : ${response.status}`);
    return (await response.json()).token;
}

async function firstWritableChannel(token) {
    const headers = { Authorization: `Bearer ${token}` };
    const { guilds } = await (await fetch(`${API}/users/me/guilds`, { headers })).json();
    for (const guild of guilds ?? []) {
        const detail = await (await fetch(`${API}/guilds/${guild.guildId}`, { headers })).json();
        const channel = (detail.guild?.channels ?? []).find((row) => row.type === "text");
        if (channel) return channel.channelId;
    }
    throw new Error("aucun salon textuel accessible");
}

async function step(tokens, channelId, concurrency) {
    const latencies = [];
    const failures = new Map();
    const until = Date.now() + SECONDS * 1000;
    let accepted = 0;
    let attempted = 0;

    const worker = async (index) => {
        const headers = {
            Authorization: `Bearer ${tokens[index % tokens.length]}`,
            "Content-Type": "application/json",
        };
        while (Date.now() < until) {
            const started = performance.now();
            try {
                const response = await fetch(`${API}/channels/${channelId}/messages`, {
                    method: "POST",
                    headers,
                    body: JSON.stringify({ content: `charge ${concurrency} ${attempted} ${Math.random()}`, nonce: randomUUID() }),
                });
                if (response.ok) {
                    latencies.push(performance.now() - started);
                    accepted += 1;
                } else {
                    failures.set(response.status, (failures.get(response.status) ?? 0) + 1);
                }
            } catch (error) {
                failures.set(error.message.slice(0, 40), (failures.get(error.message.slice(0, 40)) ?? 0) + 1);
            }
            attempted += 1;
        }
    };

    await Promise.all(Array.from({ length: concurrency }, (_unused, index) => worker(index)));

    const sorted = latencies.sort((a, b) => a - b);
    return {
        concurrence: concurrency,
        acceptées: accepted,
        parSeconde: Math.round(accepted / SECONDS),
        refusées: attempted - accepted,
        p50: Math.round(percentile(sorted, 0.5)),
        p95: Math.round(percentile(sorted, 0.95)),
        p99: Math.round(percentile(sorted, 0.99)),
        max: Math.round(sorted.at(-1) ?? 0),
        échecs: Object.fromEntries(failures),
    };
}

const tokens = [];
for (const handle of HANDLES) {
    const token = await login(handle);
    if (!token) break;
    tokens.push(token);
}
if (tokens.length === 0) throw new Error("aucune connexion possible : limitation de débit encore active");
if (tokens.length < HANDLES.length) {
    console.log(`${tokens.length} compte(s) sur ${HANDLES.length} : la limitation des connexions a fermé la porte.`);
}
const channelId = args.salon ? Number(args.salon) : await firstWritableChannel(tokens[0]);
console.log(
    `salon ${channelId} · ${tokens.length} compte(s) · ${SECONDS} s par palier · paliers ${STEPS.join(", ")}\n`
);

const rows = [];
for (const concurrency of STEPS) {
    const result = await step(tokens, channelId, concurrency);
    rows.push(result);
    const failed = Object.keys(result.échecs).length ? JSON.stringify(result.échecs) : "aucun";
    console.log(
        `concurrence ${String(result.concurrence).padStart(3)} · ` +
            `${String(result.parSeconde).padStart(4)} acceptées/s · ` +
            `p50 ${String(result.p50).padStart(4)} ms · p95 ${String(result.p95).padStart(5)} ms · ` +
            `p99 ${String(result.p99).padStart(5)} ms · refus ${failed}`
    );
}

const LIMIT_P95_MS = 400;

const broken = rows.find((row) => row.p95 > LIMIT_P95_MS || Object.keys(row.échecs).some((code) => Number(code) >= 500));

console.log("");
if (!broken) {
    const best = rows.reduce((a, b) => (b.parSeconde > a.parSeconde ? b : a));
    console.log(
        `Aucune erreur serveur, p95 sous ${LIMIT_P95_MS} ms à tous les paliers. ` +
            `Débit maximal observé : ${best.parSeconde} écritures acceptées par seconde ` +
            `à ${best.concurrence} en parallèle, p95 ${best.p95} ms.`
    );
} else {
    console.log(
        `Rupture à ${broken.concurrence} écritures simultanées : ` +
            `p95 ${broken.p95} ms, refus ${JSON.stringify(broken.échecs)}.`
    );
}
