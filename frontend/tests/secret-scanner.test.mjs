import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { hasSecret, redact, scan } from "../src/lib/secretScanner.js";

const backend = await readFile(new URL("../../backend/src/domain/secretScanner.js", import.meta.url), "utf8");
const client = await readFile(new URL("../src/lib/secretScanner.js", import.meta.url), "utf8");

const SAMPLES = [
    "AKIAIOSFODNN7EXAMPLE",
    "ghp_abcdefghijklmnopqrstuvwxyz0123456789",
    "xoxb-123456789012-abcdefghijkl",
    "AIzaSyB1234567890abcdefghijklmnopqrstuv",
    "sk_live_abcdefghijklmnop1234",
    "-----BEGIN RSA PRIVATE KEY-----",
    "mysql://qweillo:tr3sSecret@db.interne:3306/qweillo",
    "password=Tr0ub4dor&3xyz",
    "password=<votre mot de passe>",
    "token=${GITHUB_TOKEN}",
    "la taverne ouvre à 21 h",
];

test("le scanner client repère les mêmes secrets que le serveur", () => {
    const clientRules = [...client.matchAll(/id: "([a-z-]+)"/g)].map((m) => m[1]);
    const backendRules = [...backend.matchAll(/id: "([a-z-]+)"/g)].map((m) => m[1]);
    assert.deepEqual(clientRules, backendRules);
});

test("chaque échantillon dangereux est repéré et chaque gabarit est épargné", () => {
    assert.equal(hasSecret(SAMPLES[0]), true);
    assert.equal(hasSecret(SAMPLES[6]), true);
    assert.equal(hasSecret(SAMPLES[7]), true);

    assert.equal(hasSecret("password=<votre mot de passe>"), false);
    assert.equal(hasSecret("token=${GITHUB_TOKEN}"), false);
    assert.equal(hasSecret("la taverne ouvre à 21 h"), false);
});

test("le masquage ne laisse rien du secret d'origine", () => {
    for (const sample of SAMPLES.slice(0, 8)) {
        const masked = redact(sample);
        if (!hasSecret(sample)) continue;
        assert.equal(scan(masked).length, 0, `reste un secret dans « ${masked} »`);
    }
});
