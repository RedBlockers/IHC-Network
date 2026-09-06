import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import { toBase64 } from "../src/lib/e2ee/crypto.js";
import { createSession } from "../src/lib/e2ee/session.js";

function createKeyServer() {
    const devices = new Map();
    const membership = new Map();
    const epochs = new Map();
    let nextDeviceId = 10;

    const recipientsOf = (channelId) => {
        const members = membership.get(channelId) ?? new Set();
        return [...devices.values()].filter((device) => members.has(device.userId));
    };

    const server = {
        stored: [],
        setMembers: (channelId, userIds) => membership.set(channelId, new Set(userIds)),

        async handle(currentUserId, path, { method = "GET", body } = {}) {
            server.stored.push(JSON.stringify(body ?? {}));

            if (path === "/e2ee/devices" && method === "POST") {
                const publicKey = body.publicKey;
                const print = createHash("sha256")
                    .update(Buffer.concat([Buffer.from(publicKey, "base64"), Buffer.from(body.kemPublicKey, "base64")]))
                    .digest("hex");
                const existing = [...devices.values()].find((device) => device.fingerprint === print);
                if (existing && existing.userId !== currentUserId) throw new Error("403");
                if (existing) return { device: existing };
                nextDeviceId += 1;
                const device = {
                    deviceId: nextDeviceId,
                    userId: currentUserId,
                    publicKey,
                    kemPublicKey: body.kemPublicKey,
                    fingerprint: print,
                };
                devices.set(device.deviceId, device);
                return { device };
            }

            const recipientsMatch = /^\/channels\/(\d+)\/e2ee\/recipients$/.exec(path);
            if (recipientsMatch) return { devices: recipientsOf(Number(recipientsMatch[1])) };

            const getMatch = /^\/channels\/(\d+)\/e2ee\/epoch\?deviceId=(\d+)$/.exec(path);
            if (getMatch) {
                const channelId = Number(getMatch[1]);
                const deviceId = Number(getMatch[2]);
                const device = devices.get(deviceId);
                if (!device || device.userId !== currentUserId) throw new Error("403");

                const list = epochs.get(channelId) ?? [];
                const current = list.at(-1);
                if (!current) return { epoch: null, stale: true, wrappedKey: null };

                const expected = new Set(recipientsOf(channelId).map((row) => row.deviceId));
                const actual = new Set(current.shares.keys());
                const stale = expected.size !== actual.size || [...expected].some((id) => !actual.has(id));

                return {
                    epoch: { epoch: current.epoch, ephemeralPublicKey: current.ephemeralPublicKey },
                    wrappedKey: current.shares.get(deviceId)?.wrappedKey ?? null,
                    kemCipherText: current.shares.get(deviceId)?.kemCipherText ?? null,
                    stale,
                };
            }

            const postMatch = /^\/channels\/(\d+)\/e2ee\/epoch$/.exec(path);
            if (postMatch && method === "POST") {
                const channelId = Number(postMatch[1]);
                const device = devices.get(body.deviceId);
                if (!device || device.userId !== currentUserId) throw new Error("403");

                const expected = new Set(recipientsOf(channelId).map((row) => row.deviceId));
                const seen = new Set(body.shares.map((share) => share.deviceId));
                for (const id of seen) if (!expected.has(id)) throw new Error("400 appareil étranger");
                if (seen.size !== expected.size) throw new Error("400 distribution incomplète");
                if (body.shares.some((share) => !share.kemCipherText)) throw new Error("400 part non hybride");

                const list = epochs.get(channelId) ?? [];
                const epoch = list.length + 1;
                list.push({
                    epoch,
                    ephemeralPublicKey: body.ephemeralPublicKey,
                    shares: new Map(
                        body.shares.map((share) => [
                            share.deviceId,
                            { wrappedKey: share.wrappedKey, kemCipherText: share.kemCipherText },
                        ])
                    ),
                });
                epochs.set(channelId, list);
                return { epoch };
            }

            throw new Error(`route inconnue : ${method} ${path}`);
        },
    };

    return server;
}

function createClient(server, userId) {
    let record = null;
    return createSession({
        request: (path, options) => server.handle(userId, path, options),
        keystore: { load: async () => record, save: async (next) => { record = next; return next; } },
        deviceLabel: () => `appareil-${userId}`,
    });
}

const CHANNEL = 20;

test("deux appareils distincts échangent un message chiffré", async () => {
    const server = createKeyServer();
    const alice = createClient(server, 1);
    const bob = createClient(server, 2);

    await alice.ensureDevice();
    await bob.ensureDevice();
    server.setMembers(CHANNEL, [1, 2]);

    const envelope = await alice.encryptForChannel(CHANNEL, "la taverne ouvre à 21 h");
    assert.ok(envelope.startsWith("QW1:1:"));

    const epoch = Number(envelope.split(":")[1]);
    assert.equal(await bob.decryptForChannel(CHANNEL, envelope, epoch), "la taverne ouvre à 21 h");
});

test("le serveur ne voit jamais passer le texte clair", async () => {
    const server = createKeyServer();
    const alice = createClient(server, 1);
    const bob = createClient(server, 2);
    await alice.ensureDevice();
    await bob.ensureDevice();
    server.setMembers(CHANNEL, [1, 2]);

    await alice.encryptForChannel(CHANNEL, "rendez-vous derrière la cascade");
    const trace = server.stored.join(" ");
    assert.ok(!trace.includes("cascade"));
    assert.ok(!trace.includes("rendez-vous"));
});

test("l'arrivée d'un membre rend la clé périmée et déclenche une rotation couvrant tout le monde", async () => {
    const server = createKeyServer();
    const alice = createClient(server, 1);
    const bob = createClient(server, 2);
    const carla = createClient(server, 3);

    await alice.ensureDevice();
    await bob.ensureDevice();
    server.setMembers(CHANNEL, [1, 2]);
    const first = await alice.encryptForChannel(CHANNEL, "premier");
    assert.equal(Number(first.split(":")[1]), 1);

    await carla.ensureDevice();
    server.setMembers(CHANNEL, [1, 2, 3]);

    const second = await alice.encryptForChannel(CHANNEL, "second");
    assert.equal(Number(second.split(":")[1]), 2, "une nouvelle époque doit être ouverte");
    assert.equal(await carla.decryptForChannel(CHANNEL, second, 2), "second");
    assert.equal(await bob.decryptForChannel(CHANNEL, second, 2), "second");
});

test("un membre retiré ne peut pas lire ce qui suit son départ", async () => {
    const server = createKeyServer();
    const alice = createClient(server, 1);
    const bob = createClient(server, 2);

    await alice.ensureDevice();
    await bob.ensureDevice();
    server.setMembers(CHANNEL, [1, 2]);
    await alice.encryptForChannel(CHANNEL, "avant");

    server.setMembers(CHANNEL, [1]);
    bob.forgetChannel(CHANNEL);
    const after = await alice.encryptForChannel(CHANNEL, "après");
    const epoch = Number(after.split(":")[1]);
    assert.equal(epoch, 2);

    assert.equal(await bob.decryptForChannel(CHANNEL, after, epoch), null);
});

test("un ancien message reste lisible par l'appareil qui avait la clé de l'époque", async () => {
    const server = createKeyServer();
    const alice = createClient(server, 1);
    const bob = createClient(server, 2);
    await alice.ensureDevice();
    await bob.ensureDevice();
    server.setMembers(CHANNEL, [1, 2]);

    const first = await alice.encryptForChannel(CHANNEL, "message d'époque 1");
    assert.equal(await bob.decryptForChannel(CHANNEL, first, 1), "message d'époque 1");

    server.setMembers(CHANNEL, [1, 2]);
    await alice.encryptForChannel(CHANNEL, "message d'époque 2");
    assert.equal(await bob.decryptForChannel(CHANNEL, first, 1), "message d'époque 1");
});

test("deux appareils dérivent la même clé média, que le serveur n'a jamais vue", async () => {
    const server = createKeyServer();
    const alice = createClient(server, 1);
    const bob = createClient(server, 2);
    await alice.ensureDevice();
    await bob.ensureDevice();
    server.setMembers(CHANNEL, [1, 2]);

    await alice.encryptForChannel(CHANNEL, "la taverne ouvre à 21 h");
    const keyA = await alice.mediaKeyForChannel(CHANNEL);
    const keyB = await bob.mediaKeyForChannel(CHANNEL);
    assert.ok(keyA);
    assert.deepEqual([...keyA], [...keyB]);

    const material = toBase64(keyA);
    const trace = server.stored.join(" ");
    assert.ok(!trace.includes(material));
    assert.ok(!trace.includes("la taverne"));
});

test("un appareil ne peut pas réclamer la part d'un autre compte", async () => {
    const server = createKeyServer();
    const alice = createClient(server, 1);
    const bob = createClient(server, 2);
    const alterEgo = createClient(server, 3);

    const aliceDevice = await alice.ensureDevice();
    await bob.ensureDevice();
    await alterEgo.ensureDevice();
    server.setMembers(CHANNEL, [1, 2, 3]);
    await alice.encryptForChannel(CHANNEL, "secret");

    await assert.rejects(
        () => server.handle(3, `/channels/${CHANNEL}/e2ee/epoch?deviceId=${aliceDevice.deviceId}`),
        /403/
    );
});
