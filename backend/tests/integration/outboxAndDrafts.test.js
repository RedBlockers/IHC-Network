"use strict";

const request = require("supertest");
const createApp = require("../../src/app");
const { on } = require("../helpers/db");
const { allowWrite } = require("../helpers/writePath");
const { makeUser, authenticateAs } = require("../helpers/auth");

describe("File d'envoi et brouillons", () => {
    const alice = makeUser({ userId: 1, handle: "alice" });
    const app = createApp();
    let token;

    const NONCE = "3f2504e0-4f89-11d3-9a0c-0305e82c3301";

    const message = (overrides = {}) => ({
        messageId: "7168291357943578624",
        channelId: 10,
        content: "bonjour",
        createdAt: new Date(),
        userId: 1,
        handle: "alice",
        displayName: "Alice",
        avatar: null,
        ...overrides,
    });

    beforeEach(() => {
        token = authenticateAs(alice);
        on("access.resolveChannel", () => [{ channelId: 10, type: "text", guildId: 4, friendshipId: null }]);
        on("access.channelPermission", () => [{ ownerId: 1, baseEffect: null, targetType: null, overrideEffect: null }]);
        allowWrite();
        on("attachments.listForMessages", () => []);
        on("messages.resolveMentions", () => []);
        on("emojis.findByNames", () => []);
        on("roles.listByGuild", () => []);
    });

    const auth = (call) => call.set("Authorization", token(alice));
    const send = (body) => auth(request(app).post("/api/v1/channels/10/messages")).send(body);

    describe("Déduplication", () => {
        test("un renvoi sous la même marque rend le message d'origine", async () => {
            on("messages.findByNonce", () => message());
            on("messages.create", () => {
                throw new Error("aucun second message ne doit être écrit");
            });

            const response = await send({ content: "bonjour", clientNonce: NONCE }).expect(201);

            expect(response.body.message.messageId).toBe("7168291357943578624");
            expect(response.body.message.deduplicated).toBe(true);
        });

        test("deux envois simultanés : le perdant rend le message du gagnant", async () => {
            let seen = 0;
            on("messages.findByNonce", () => (seen++ === 0 ? null : message()));
            on("messages.create", () => {
                const error = new Error("doublon");
                error.code = "ER_DUP_ENTRY";
                throw error;
            });

            const response = await send({ content: "bonjour", clientNonce: NONCE }).expect(201);

            expect(response.body.message.deduplicated).toBe(true);
        });

        test("sans marque, rien n'est dédupliqué", async () => {
            on("messages.findByNonce", () => {
                throw new Error("aucune recherche ne doit avoir lieu sans marque");
            });
            on("messages.create", () => ({ affectedRows: 1 }));
            on("messages.findById", () => message());

            await send({ content: "bonjour" }).expect(201);
        });

        test("une marque qui n'est pas un identifiant est refusée", async () => {
            await send({ content: "bonjour", clientNonce: "pas-un-uuid" }).expect(400);
        });

        test("la marque est écrite avec le message", async () => {
            let params = null;
            on("messages.findByNonce", () => null);
            on("messages.create", (received) => {
                params = received;
                return { affectedRows: 1 };
            });
            on("messages.findById", () => message());

            await send({ content: "bonjour", clientNonce: NONCE }).expect(201);

            expect(params).toContain(NONCE);
        });
    });

    describe("Brouillons", () => {
        test("un brouillon se garde par salon", async () => {
            let written = null;
            on("drafts.save", (params) => {
                written = params;
                return { affectedRows: 1 };
            });

            await auth(request(app).put("/api/v1/channels/10/draft")).send({ content: "à moitié écrit" }).expect(200);

            expect(written).toEqual([1, 10, "à moitié écrit"]);
        });

        test("un brouillon vidé est supprimé", async () => {
            let removed = false;
            on("drafts.remove", () => {
                removed = true;
                return { affectedRows: 1 };
            });
            on("drafts.save", () => {
                throw new Error("un brouillon vide ne doit pas être enregistré");
            });

            const response = await auth(request(app).put("/api/v1/channels/10/draft")).send({ content: "   " }).expect(200);

            expect(removed).toBe(true);
            expect(response.body.draft).toBeNull();
        });

        test("un brouillon peut dépasser la limite d'un message", async () => {
            on("drafts.save", () => ({ affectedRows: 1 }));

            await auth(request(app).put("/api/v1/channels/10/draft"))
                .send({ content: "a".repeat(2600) })
                .expect(200);
        });

        test("les brouillons se retrouvent en changeant d'appareil", async () => {
            on("drafts.listForUser", () => [
                { channelId: 10, content: "à moitié écrit", updatedAt: new Date() },
            ]);

            const response = await auth(request(app).get("/api/v1/users/me/drafts")).expect(200);

            expect(response.body.drafts[0]).toEqual(
                expect.objectContaining({ channelId: 10, content: "à moitié écrit" })
            );
        });

        test("refuse un brouillon dans un salon où l'on ne peut pas écrire", async () => {
            on("access.channelPermission", (params) => [
                {
                    ownerId: 99,
                    baseEffect: params[1] === "SEND_MESSAGES" ? "deny" : "allow",
                    targetType: null,
                    overrideEffect: null,
                },
            ]);
            on("drafts.save", () => {
                throw new Error("aucune écriture ne doit avoir lieu");
            });

            await auth(request(app).put("/api/v1/channels/10/draft")).send({ content: "x" }).expect(403);
        });
    });
});
