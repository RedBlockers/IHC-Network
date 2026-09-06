"use strict";

const crypto = require("node:crypto");
const request = require("supertest");

const createApp = require("../../src/app");
const { on } = require("../helpers/db");
const { makeUser, authenticateAs } = require("../helpers/auth");

const KEY_A = Buffer.alloc(32, 1);
const KEY_B = Buffer.alloc(32, 2);
const KEM_A = Buffer.alloc(1184, 3);
const KEM_B = Buffer.alloc(1184, 4);
const EPHEMERAL = Buffer.alloc(32, 9);
const WRAPPED = Buffer.alloc(60, 7);
const KEM_CT = Buffer.alloc(1088, 5);

const fingerprint = (...keys) => crypto.createHash("sha256").update(Buffer.concat(keys)).digest("hex");

const b64 = (buffer) => buffer.toString("base64");

function allowChannel(user) {
    on("access.resolveChannel", () => ({ channelId: 20, guildId: 7, type: "text", name: "secret", position: 0 }));
    on("channels.findById", () => ({ channelId: 20, guildId: 7, type: "text", name: "secret", description: "", position: 0 }));
    on("access.channelPermission", () => [{ ownerId: 1, baseEffect: "allow", targetType: null, overrideEffect: null }]);
    on("access.guildRole", () => ({ role: "member" }));
    return authenticateAs(user)(user);
}

const RECIPIENTS = [
    { deviceId: 11, userId: 1, publicKey: KEY_A, kemPublicKey: KEM_A, fingerprint: fingerprint(KEY_A, KEM_A), label: "portable" },
    { deviceId: 12, userId: 2, publicKey: KEY_B, kemPublicKey: KEM_B, fingerprint: fingerprint(KEY_B, KEM_B), label: "fixe" },
];

describe("Chiffrement de bout en bout", () => {
    it("recalcule l'empreinte côté serveur au lieu de croire le client", async () => {
        const user = makeUser({ userId: 1, handle: "alice" });
        const authorization = authenticateAs(user)(user);

        on("e2ee.findDeviceByFingerprint", () => null);
        let stored = null;
        on("e2ee.upsertDevice", (params) => {
            stored = params;
            return { affectedRows: 1 };
        });
        on("e2ee.findDeviceByFingerprint", () => ({
            deviceId: 11, userId: 1, publicKey: KEY_A, kemPublicKey: KEM_A, fingerprint: fingerprint(KEY_A, KEM_A), label: "portable", revokedAt: null,
        }));

        const response = await request(createApp())
            .post("/api/v1/e2ee/devices")
            .set("Authorization", authorization)
            .send({ publicKey: b64(KEY_A), kemPublicKey: b64(KEM_A), label: "portable" });

        expect(response.status).toBe(200);
        expect(response.body.device.fingerprint).toBe(fingerprint(KEY_A, KEM_A));
        expect(stored[3]).toBe(fingerprint(KEY_A, KEM_A));
        expect(Buffer.from(stored[2]).equals(KEM_A)).toBe(true);
    });

    it("refuse d'enregistrer une clé publique déjà rattachée à un autre compte", async () => {
        const intruder = makeUser({ userId: 3, handle: "mallory" });
        const authorization = authenticateAs(intruder)(intruder);
        on("e2ee.findDeviceByFingerprint", () => ({ deviceId: 11, userId: 1, fingerprint: fingerprint(KEY_A, KEM_A) }));

        const response = await request(createApp())
            .post("/api/v1/e2ee/devices")
            .set("Authorization", authorization)
            .send({ publicKey: b64(KEY_A), kemPublicKey: b64(KEM_A) });

        expect(response.status).toBe(403);
    });

    it("n'accepte une rotation que si elle couvre tous les appareils du salon", async () => {
        const user = makeUser({ userId: 1, handle: "alice" });
        const authorization = allowChannel(user);
        on("e2ee.findDeviceById", () => ({ deviceId: 11, userId: 1, revokedAt: null }));
        on("e2ee.listChannelRecipients", () => RECIPIENTS);

        const response = await request(createApp())
            .post("/api/v1/channels/20/e2ee/epoch")
            .set("Authorization", authorization)
            .send({
                deviceId: 11,
                ephemeralPublicKey: b64(EPHEMERAL),
                shares: [{ deviceId: 11, wrappedKey: b64(WRAPPED), kemCipherText: b64(KEM_CT) }],
            });

        expect(response.status).toBe(400);
        expect(response.body.error.message).toBe("La distribution doit couvrir tous les appareils du salon.");
    });

    it("refuse une part destinée à un appareil étranger au salon", async () => {
        const user = makeUser({ userId: 1, handle: "alice" });
        const authorization = allowChannel(user);
        on("e2ee.findDeviceById", () => ({ deviceId: 11, userId: 1, revokedAt: null }));
        on("e2ee.listChannelRecipients", () => RECIPIENTS);

        const response = await request(createApp())
            .post("/api/v1/channels/20/e2ee/epoch")
            .set("Authorization", authorization)
            .send({
                deviceId: 11,
                ephemeralPublicKey: b64(EPHEMERAL),
                shares: [
                    { deviceId: 11, wrappedKey: b64(WRAPPED), kemCipherText: b64(KEM_CT) },
                    { deviceId: 12, wrappedKey: b64(WRAPPED), kemCipherText: b64(KEM_CT) },
                    { deviceId: 99, wrappedKey: b64(WRAPPED), kemCipherText: b64(KEM_CT) },
                ],
            });

        expect(response.status).toBe(400);
        expect(response.body.error.message).toBe("Une part vise un appareil étranger au salon.");
    });

    it("refuse d'agir au nom d'un appareil qui n'appartient pas au compte", async () => {
        const user = makeUser({ userId: 1, handle: "alice" });
        const authorization = allowChannel(user);
        on("e2ee.findDeviceById", () => ({ deviceId: 12, userId: 2, revokedAt: null }));

        const response = await request(createApp())
            .post("/api/v1/channels/20/e2ee/epoch")
            .set("Authorization", authorization)
            .send({
                deviceId: 12,
                ephemeralPublicKey: b64(EPHEMERAL),
                shares: [{ deviceId: 12, wrappedKey: b64(WRAPPED), kemCipherText: b64(KEM_CT) }],
            });

        expect(response.status).toBe(403);
    });

    it("alloue le numéro d'époque côté serveur et enregistre chaque part", async () => {
        const user = makeUser({ userId: 1, handle: "alice" });
        const authorization = allowChannel(user);
        on("e2ee.findDeviceById", () => ({ deviceId: 11, userId: 1, revokedAt: null }));
        on("e2ee.listChannelRecipients", () => RECIPIENTS);
        on("e2ee.currentEpoch", () => ({ epochId: 4, channelId: 20, epoch: 3 }));

        let created = null;
        let inserted = null;
        let channelEpoch = null;
        on("e2ee.createEpoch", (params) => {
            created = params;
            return { insertId: 5 };
        });
        on("e2ee.insertShares", (params) => {
            inserted = params;
            return { affectedRows: 2 };
        });
        on("e2ee.setChannelEpoch", (params) => {
            channelEpoch = params;
            return { affectedRows: 1 };
        });

        const response = await request(createApp())
            .post("/api/v1/channels/20/e2ee/epoch")
            .set("Authorization", authorization)
            .send({
                deviceId: 11,
                ephemeralPublicKey: b64(EPHEMERAL),
                shares: [
                    { deviceId: 11, wrappedKey: b64(WRAPPED), kemCipherText: b64(KEM_CT) },
                    { deviceId: 12, wrappedKey: b64(WRAPPED), kemCipherText: b64(KEM_CT) },
                ],
            });

        expect(response.status).toBe(201);
        expect(response.body.epoch).toBe(4);
        expect(created[1]).toBe(4);
        expect(inserted).toHaveLength(8);
        expect(channelEpoch).toEqual([4, 20]);
    });

    it("refuse une part sans encapsulation post-quantique", async () => {
        const user = makeUser({ userId: 1, handle: "alice" });
        const authorization = allowChannel(user);
        on("e2ee.findDeviceById", () => ({ deviceId: 11, userId: 1, revokedAt: null }));
        on("e2ee.listChannelRecipients", () => RECIPIENTS);

        const response = await request(createApp())
            .post("/api/v1/channels/20/e2ee/epoch")
            .set("Authorization", authorization)
            .send({
                deviceId: 11,
                ephemeralPublicKey: b64(EPHEMERAL),
                shares: [
                    { deviceId: 11, wrappedKey: b64(WRAPPED) },
                    { deviceId: 12, wrappedKey: b64(WRAPPED) },
                ],
            });

        expect(response.status).toBe(400);
    });

    it("ne sert que la part de l'appareil qui interroge et signale une clé périmée", async () => {
        const user = makeUser({ userId: 1, handle: "alice" });
        const authorization = allowChannel(user);
        on("e2ee.findDeviceById", () => ({ deviceId: 11, userId: 1, revokedAt: null }));
        on("e2ee.currentEpoch", () => ({
            epochId: 5, channelId: 20, epoch: 4, createdBy: 1, createdByDeviceId: 11,
            ephemeralPublicKey: EPHEMERAL, algorithm: "x25519-hkdf-sha256/aes-256-gcm",
        }));
        on("e2ee.listChannelRecipients", () => RECIPIENTS);
        on("e2ee.listShareDeviceIds", () => [{ deviceId: 11 }]);
        on("e2ee.findShareForDevice", (params) => {
            expect(params).toEqual([5, 11]);
            return { wrappedKey: WRAPPED, kemCipherText: KEM_CT };
        });

        const response = await request(createApp())
            .get("/api/v1/channels/20/e2ee/epoch?deviceId=11")
            .set("Authorization", authorization);

        expect(response.status).toBe(200);
        expect(response.body.epoch.epoch).toBe(4);
        expect(response.body.wrappedKey).toBe(b64(WRAPPED));
        expect(response.body.kemCipherText).toBe(b64(KEM_CT));
        expect(response.body.stale).toBe(true);
    });

    it("ne divulgue jamais la part d'un autre appareil", async () => {
        const user = makeUser({ userId: 1, handle: "alice" });
        const authorization = allowChannel(user);
        on("e2ee.findDeviceById", () => ({ deviceId: 12, userId: 2, revokedAt: null }));

        const response = await request(createApp())
            .get("/api/v1/channels/20/e2ee/epoch?deviceId=12")
            .set("Authorization", authorization);

        expect(response.status).toBe(403);
    });
});
