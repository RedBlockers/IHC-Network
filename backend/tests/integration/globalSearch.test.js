"use strict";

const request = require("supertest");
const createApp = require("../../src/app");
const { on } = require("../helpers/db");
const { makeUser, authenticateAs } = require("../helpers/auth");

describe("Recherche globale", () => {
    const alice = makeUser({ userId: 1, handle: "alice" });
    const app = createApp();
    let token;

    beforeEach(() => {
        token = authenticateAs(alice);
        on("guilds.listIdsForUser", () => [{ guildId: 4 }, { guildId: 5 }]);
        on("channels.listByGuild", (params) =>
            Number(params[0]) === 4
                ? [
                      { channelId: 10, guildId: 4, name: "general", type: "text", e2eeEnabled: 0 },
                      { channelId: 11, guildId: 4, name: "prive", type: "text", e2eeEnabled: 0 },
                      { channelId: 12, guildId: 4, name: "secret", type: "text", e2eeEnabled: 1 },
                  ]
                : [{ channelId: 20, guildId: 5, name: "general", type: "text", e2eeEnabled: 0 }]
        );
        on("channels.listDirectForUser", () => [
            { channelId: 30, type: "text", e2eeEnabled: 0, name: "Bob", userId: 2, handle: "bob", displayName: "Bob" },
        ]);
        on("access.channelPermission", (params) =>
            Number(params[2]) === 11
                ? [{ ownerId: 99, baseEffect: "deny", targetType: null, overrideEffect: null }]
                : [{ ownerId: 99, baseEffect: "allow", targetType: null, overrideEffect: null }]
        );
        on("search.messages", () => []);
        on("search.files", () => []);
    });

    const auth = (call) => call.set("Authorization", token(alice));

    test("cherche dans toutes les communautés et les messages privés", async () => {
        let scanned = null;
        on("search.messages", (params) => {
            scanned = params.slice(0, -2).map(Number);
            return [];
        });

        await auth(request(app).get("/api/v1/search?q=taverne")).expect(200);

        expect(scanned).toEqual(expect.arrayContaining([10, 20, 30]));
    });

    test("n'interroge jamais un salon refusé", async () => {
        let scanned = null;
        on("search.messages", (params) => {
            scanned = params.slice(0, -2).map(Number);
            return [];
        });

        await auth(request(app).get("/api/v1/search?q=taverne")).expect(200);

        expect(scanned).not.toContain(11);
    });

    test("écarte les salons chiffrés et le dit", async () => {
        const response = await auth(request(app).get("/api/v1/search?q=taverne")).expect(200);

        expect(response.body.excludedEncrypted).toEqual(["secret"]);
    });

    test("le résultat porte sa communauté d'origine", async () => {
        on("search.messages", () => [
            {
                messageId: "900",
                channelId: 20,
                content: "rendez-vous à la taverne",
                createdAt: new Date(),
                userId: 2,
                handle: "bob",
                displayName: "Bob",
                avatar: null,
                channelName: "general",
                channelType: "text",
            },
        ]);

        const response = await auth(request(app).get("/api/v1/search?q=taverne")).expect(200);

        expect(response.body.results[0].guildId).toBe(5);
    });

    test("refuse une recherche trop courte", async () => {
        await auth(request(app).get("/api/v1/search?q=a")).expect(400);
    });
});

describe("Recherche de fichiers", () => {
    const alice = makeUser({ userId: 1, handle: "alice" });
    const app = createApp();
    let token;

    beforeEach(() => {
        token = authenticateAs(alice);
        on("guilds.listIdsForUser", () => [{ guildId: 4 }]);
        on("channels.listByGuild", () => [
            { channelId: 10, guildId: 4, name: "general", type: "text", e2eeEnabled: 0 },
            { channelId: 12, guildId: 4, name: "secret", type: "text", e2eeEnabled: 1 },
        ]);
        on("channels.listDirectForUser", () => []);
        on("access.channelPermission", () => [
            { ownerId: 1, baseEffect: "allow", targetType: null, overrideEffect: null },
        ]);
    });

    const auth = (call) => call.set("Authorization", token(alice));

    test("cherche par fragment de nom, pas par mot du langage", async () => {
        let captured = null;
        on("search.files", (params, sql) => {
            captured = { params, sql };
            return [];
        });

        await auth(request(app).get("/api/v1/search/files?q=facture-2026")).expect(200);

        expect(captured.sql).toContain("a.name LIKE ?");
        expect(captured.sql).toContain("FROM message_attachments a");
        expect(captured.params).toContain("%facture-2026%");
    });

    test("les salons chiffrés ne sont pas écartés", async () => {
        let scanned = null;
        on("search.files", (params) => {
            scanned = params.slice(0, -2).map(Number);
            return [];
        });

        await auth(request(app).get("/api/v1/search/files?q=rapport")).expect(200);

        expect(scanned).toContain(12);
    });

    test("ne rend que les fichiers réellement attachés à un message", async () => {
        let sql = null;
        on("search.files", (_params, statement) => {
            sql = statement;
            return [];
        });

        await auth(request(app).get("/api/v1/search/files?q=rapport")).expect(200);

        expect(sql).toContain("a.messageId IS NOT NULL");
    });

    test("rend le salon et l'auteur avec chaque fichier", async () => {
        on("search.files", () => [
            {
                attachmentId: 7,
                name: "rapport.pdf",
                mime: "application/pdf",
                bytes: 1024,
                url: "/files/rapport.pdf",
                width: null,
                height: null,
                path: null,
                version: 1,
                createdAt: new Date(),
                channelId: 10,
                channelName: "general",
                guildId: 4,
                userId: 2,
                handle: "bob",
                displayName: "Bob",
                avatar: null,
            },
        ]);

        const response = await auth(request(app).get("/api/v1/search/files?q=rapport")).expect(200);

        expect(response.body.results[0].name).toBe("rapport.pdf");
        expect(response.body.results[0].channel.name).toBe("general");
        expect(response.body.results[0].author.handle).toBe("bob");
    });
});
