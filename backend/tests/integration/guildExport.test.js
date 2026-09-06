"use strict";

const request = require("supertest");
const createApp = require("../../src/app");
const { on } = require("../helpers/db");
const { makeUser, authenticateAs } = require("../helpers/auth");

describe("Export d'une communauté", () => {
    const alice = makeUser({ userId: 1, handle: "alice" });
    const app = createApp();
    let token;

    beforeEach(() => {
        token = authenticateAs(alice);
        on("guilds.findById", () => [{ guildId: 7, name: "Laguna", description: "", ownerId: 1 }]);
        on("access.guildRole", () => [{ role: "owner" }]);
        on("channels.listByGuild", () => [
            { channelId: 10, guildId: 7, name: "general", type: "text", e2eeEnabled: 0 },
            { channelId: 11, guildId: 7, name: "secret", type: "text", e2eeEnabled: 1 },
        ]);
        on("users.listByGuild", () => [
            { userId: 1, handle: "alice", displayName: "Alice", role: "owner", email: "alice@example.com", roles: "[]" },
        ]);
        on("roles.listByGuild", () => []);
        on("guilds.exportMessages", () => []);
    });

    const exportIt = () => request(app).get("/api/v1/guilds/7/export").set("Authorization", token(alice));

    test("rend un fichier nommé", async () => {
        const response = await exportIt().expect(200);
        expect(response.headers["content-disposition"]).toContain("qweillo-7.json");
    });

    test("n'expose pas les adresses des membres", async () => {
        const response = await exportIt().expect(200);

        expect(response.text).not.toContain("alice@example.com");
        expect(response.text).toContain("alice");
    });

    test("marque les salons chiffrés au lieu de prétendre les lire", async () => {
        on("guilds.exportMessages", (params) =>
            Number(params[1]) === 0
                ? [
                      { messageId: "900", channelId: 10, channelName: "general", content: "bonjour", createdAt: new Date(), editedAt: null, authorHandle: "alice", webhookName: null },
                      { messageId: "901", channelId: 11, channelName: "secret", content: "QW1:1:abc:def", createdAt: new Date(), editedAt: null, authorHandle: "alice", webhookName: null },
                  ]
                : []
        );

        const body = JSON.parse((await exportIt().expect(200)).text);

        expect(body.messages.find((m) => m.messageId === "900").encrypted).toBe(false);
        expect(body.messages.find((m) => m.messageId === "901").encrypted).toBe(true);
        expect(body.notice).toMatch(/chiffrés/i);
    });

    test("pagine plutôt que de tout charger", async () => {
        const pages = [];
        on("guilds.exportMessages", (params) => {
            pages.push(String(params[1]));
            if (pages.length > 2) return [];
            const base = pages.length * 1000;
            return Array.from({ length: 2000 }, (_v, i) => ({
                messageId: String(base + i + 1),
                channelId: 10,
                channelName: "general",
                content: "x",
                createdAt: new Date(),
                editedAt: null,
                authorHandle: "alice",
                webhookName: null,
            }));
        });

        const body = JSON.parse((await exportIt().expect(200)).text);

        expect(pages.length).toBeGreaterThan(1);
        expect(pages[0]).toBe("0");
        expect(body.messageCount).toBe(4000);
    });

    test("refuse à un administrateur qui n'est pas propriétaire", async () => {
        on("access.guildRole", () => [{ role: "admin" }]);

        await exportIt().expect(403);
    });

    test("le service revérifie la propriété", async () => {
        on("guilds.findById", () => [{ guildId: 7, name: "Laguna", description: "", ownerId: 99 }]);

        await exportIt().expect(403);
    });
});
