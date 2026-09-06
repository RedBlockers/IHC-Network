"use strict";

const request = require("supertest");
const createApp = require("../../src/app");
const { on } = require("../helpers/db");
const { makeUser, authenticateAs } = require("../helpers/auth");

describe("Webhooks entrants", () => {
    const alice = makeUser({ userId: 1, handle: "alice" });
    const app = createApp();
    let token;

    beforeEach(() => {
        token = authenticateAs(alice);
        on("access.resolveChannel", () => [{ channelId: 10, type: "text", guildId: 4, friendshipId: null }]);
        on("access.channelPermission", () => [
            { ownerId: 1, baseEffect: null, targetType: null, overrideEffect: null },
        ]);
        on("webhooks.listForChannel", () => []);
    });

    const auth = (call) => call.set("Authorization", token(alice));

    describe("Création", () => {
        test("le secret n'est rendu qu'à la création", async () => {
            on("webhooks.create", () => ({ insertId: 5, affectedRows: 1 }));

            const created = await auth(request(app).post("/api/v1/channels/10/webhooks"))
                .send({ name: "Intégration continue" })
                .expect(201);

            expect(created.body.webhook.token).toEqual(expect.any(String));

            on("webhooks.listForChannel", () => [
                {
                    webhookId: 5,
                    name: "Intégration continue",
                    createdAt: new Date(),
                    lastUsedAt: null,
                    uses: 0,
                    revokedAt: null,
                    authorHandle: "alice",
                    authorDisplayName: "Alice",
                },
            ]);
            const listed = await auth(request(app).get("/api/v1/channels/10/webhooks")).expect(200);

            expect(JSON.stringify(listed.body)).not.toContain(created.body.webhook.token);
        });

        test("seul le condensat du secret est stocké", async () => {
            let written = null;
            on("webhooks.create", (params) => {
                written = params;
                return { insertId: 5, affectedRows: 1 };
            });

            const created = await auth(request(app).post("/api/v1/channels/10/webhooks"))
                .send({ name: "CI" })
                .expect(201);

            expect(written).not.toContain(created.body.webhook.token);
            expect(written.some((value) => typeof value === "string" && /^[0-9a-f]{64}$/.test(value))).toBe(true);
        });

        test("refuse un salon qui n'accueille pas de message", async () => {
            on("access.resolveChannel", () => [{ channelId: 10, type: "voice", guildId: 4, friendshipId: null }]);

            await auth(request(app).post("/api/v1/channels/10/webhooks")).send({ name: "CI" }).expect(400);
        });

        test("refuse à qui ne gère pas les webhooks", async () => {
            on("access.channelPermission", (params) => [
                {
                    ownerId: 99,
                    baseEffect: params[1] === "MANAGE_WEBHOOKS" ? "deny" : "allow",
                    targetType: null,
                    overrideEffect: null,
                },
            ]);

            await auth(request(app).post("/api/v1/channels/10/webhooks")).send({ name: "CI" }).expect(403);
        });
    });

    describe("Publication", () => {
        const SECRET = "a".repeat(43);

        beforeEach(() => {
            on("channels.findById", () => [{ channelId: 10, type: "text", guildId: 4, name: "deploiements" }]);
            on("webhooks.recordUse", () => ({ affectedRows: 1 }));
            on("messages.createFromWebhook", () => ({ affectedRows: 1 }));
            on("messages.findById", () => ({
                messageId: "900",
                channelId: 10,
                content: "Déploiement réussi",
                createdAt: new Date(),
                userId: 1,
                handle: "alice",
                displayName: "Alice",
                avatar: null,
                webhookName: "Intégration continue",
            }));
        });

        test("publie sans aucune session", async () => {
            on("webhooks.findByTokenHash", () => ({
                webhookId: 5,
                channelId: 10,
                guildId: 4,
                name: "Intégration continue",
            }));

            const response = await request(app)
                .post(`/api/v1/webhooks/${SECRET}`)
                .send({ content: "Déploiement réussi" })
                .expect(201);

            expect(response.body.message.author.displayName).toBe("Intégration continue");
            expect(response.body.message.author.isWebhook).toBe(true);
        });

        test("refuse de publier après la fermeture d’un salon temporaire", async () => {
            on("webhooks.findByTokenHash", () => ({ webhookId: 5, channelId: 10, guildId: 4, name: "CI" }));
            on("channels.findById", () => ({
                channelId: 10,
                type: "ephemeral",
                guildId: 4,
                expiresAt: new Date(Date.now() - 1000),
            }));
            let written = false;
            on("messages.createFromWebhook", () => {
                written = true;
                return { affectedRows: 1 };
            });

            const response = await request(app).post(`/api/v1/webhooks/${SECRET}`).send({ content: "Après fermeture" });

            expect(response.status).toBe(403);
            expect(response.body.error.message).toMatch(/temporaire.*fermé/);
            expect(written).toBe(false);
        });

        test("un secret faux et un webhook révoqué donnent la même réponse", async () => {
            on("webhooks.findByTokenHash", () => null);

            const response = await request(app).post(`/api/v1/webhooks/${SECRET}`).send({ content: "x" }).expect(401);

            expect(response.body.error.message).toMatch(/inconnu ou révoqué/i);
        });

        test("les secrets du message sont masqués comme pour un humain", async () => {
            on("webhooks.findByTokenHash", () => ({ webhookId: 5, channelId: 10, guildId: 4, name: "CI" }));
            let written = null;
            on("messages.createFromWebhook", (params) => {
                written = params;
                return { affectedRows: 1 };
            });

            await request(app)
                .post(`/api/v1/webhooks/${SECRET}`)
                .send({ content: "build ok AKIAIOSFODNN7EXAMPLE" })
                .expect(201);

            expect(JSON.stringify(written)).not.toContain("AKIAIOSFODNN7EXAMPLE");
        });

        test("l'usage est compté", async () => {
            on("webhooks.findByTokenHash", () => ({ webhookId: 5, channelId: 10, guildId: 4, name: "CI" }));
            let counted = false;
            on("webhooks.recordUse", () => {
                counted = true;
                return { affectedRows: 1 };
            });

            await request(app).post(`/api/v1/webhooks/${SECRET}`).send({ content: "ok" }).expect(201);

            expect(counted).toBe(true);
        });
    });

    test("révoquer coupe immédiatement", async () => {
        let sql = null;
        on("webhooks.revoke", (_params, statement) => {
            sql = statement;
            return { affectedRows: 1 };
        });

        await auth(request(app).delete("/api/v1/channels/10/webhooks/5")).expect(204);

        expect(sql).toContain("revokedAt = NOW()");
    });
});
