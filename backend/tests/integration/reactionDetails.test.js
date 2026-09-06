"use strict";

const request = require("supertest");
const createApp = require("../../src/app");
const { on } = require("../helpers/db");
const { makeUser, authenticateAs } = require("../helpers/auth");

describe("Réactions renforcées", () => {
    const alice = makeUser({ userId: 1, handle: "alice" });
    const app = createApp();
    let token;

    beforeEach(() => {
        token = authenticateAs(alice);
        on("access.resolveChannel", () => [{ channelId: 10, type: "text", guildId: 4, friendshipId: null }]);
        on("access.channelPermission", () => [{ ownerId: 1, baseEffect: null, targetType: null, overrideEffect: null }]);
    });

    const auth = (call) => call.set("Authorization", token(alice));

    describe("Qui a réagi", () => {
        test("rend les personnes, dans l'ordre où elles ont réagi", async () => {
            on("messages.channelOf", () => ({ channelId: 10 }));
            on("reactions.authors", (_params, sql) => {
                expect(sql).toContain("ORDER BY r.createdAt ASC");
                return [
                    { userId: 2, handle: "bob", displayName: "Bob", avatar: null },
                    { userId: 3, handle: "carla", displayName: "Carla", avatar: null },
                ];
            });

            const response = await auth(
                request(app).get(`/api/v1/channels/10/messages/900/reactions/${encodeURIComponent("🏆")}`)
            ).expect(200);

            expect(response.body.users.map((user) => user.handle)).toEqual(["bob", "carla"]);
        });

        test("la liste est bornée", async () => {
            on("messages.channelOf", () => ({ channelId: 10 }));
            let sql = null;
            on("reactions.authors", (_params, statement) => {
                sql = statement;
                return [];
            });

            await auth(request(app).get(`/api/v1/channels/10/messages/900/reactions/${encodeURIComponent("🏆")}`)).expect(200);

            expect(sql).toMatch(/LIMIT \d+/);
        });

        test("refuse un message qui n'appartient pas à ce salon", async () => {
            on("messages.channelOf", () => ({ channelId: 99 }));
            on("reactions.authors", () => {
                throw new Error("aucune lecture ne doit avoir lieu");
            });

            await auth(request(app).get(`/api/v1/channels/10/messages/900/reactions/${encodeURIComponent("🏆")}`)).expect(404);
        });
    });

    describe("Emojis les plus posés", () => {
        test("sont dérivés des réactions, jamais entretenus à côté", async () => {
            let sql = null;
            on("reactions.favorites", (_params, statement) => {
                sql = statement;
                return [
                    { emoji: "🏆", uses: 12 },
                    { emoji: "👍", uses: 5 },
                ];
            });

            const response = await auth(request(app).get("/api/v1/users/me/reactions")).expect(200);

            expect(response.body.emojis[0]).toEqual({ emoji: "🏆", uses: 12 });
            expect(sql).toContain("FROM message_reactions");
            expect(sql).toContain("GROUP BY emoji");
        });

        test("l'égalité se départage par la dernière utilisation", async () => {
            let sql = null;
            on("reactions.favorites", (_params, statement) => {
                sql = statement;
                return [];
            });

            await auth(request(app).get("/api/v1/users/me/reactions")).expect(200);

            expect(sql).toContain("MAX(createdAt) DESC");
        });

        test("ne lit que ses propres réactions", async () => {
            let params = null;
            on("reactions.favorites", (received) => {
                params = received;
                return [];
            });

            await auth(request(app).get("/api/v1/users/me/reactions")).expect(200);

            expect(params).toEqual([1]);
        });
    });
});
