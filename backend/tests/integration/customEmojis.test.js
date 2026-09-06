"use strict";

const request = require("supertest");
const createApp = require("../../src/app");
const { on } = require("../helpers/db");
const { allowWrite } = require("../helpers/writePath");
const { makeUser, authenticateAs } = require("../helpers/auth");
const emojiService = require("../../src/services/emojiService");

describe("Emojis personnalisés", () => {
    const alice = makeUser({ userId: 1, handle: "alice" });
    const app = createApp();
    let token;

    beforeEach(() => {
        token = authenticateAs(alice);
        on("guilds.findById", () => [{ guildId: 4, name: "Laguna", ownerId: 1 }]);
        on("access.guildRole", () => [{ role: "owner" }]);
        on("access.guildPermission", () => [{ ownerId: 1, effect: "allow" }]);
    });

    const auth = (call) => call.set("Authorization", token(alice));

    describe("Détection dans un texte", () => {
        test("repère un emoji cité", () => {
            expect(emojiService.citedNames("bravo :trophee: vraiment")).toEqual(["trophee"]);
        });

        test("ne se déclenche pas dans une adresse", () => {
            expect(emojiService.citedNames("voir http://exemple:8080:/x")).toEqual([]);
        });

        test("ignore un nom trop court ou majuscule", () => {
            expect(emojiService.citedNames("un :a: et un :Trophee:")).toEqual([]);
        });

        test("ne rend qu'une fois un emoji cité plusieurs fois", () => {
            expect(emojiService.citedNames(":ok: puis :ok: encore :ok:")).toEqual(["ok"]);
        });
    });

    describe("Ajout", () => {
        test("refuse un nom impossible à taper", async () => {
            await auth(request(app).post("/api/v1/guilds/4/emojis"))
                .field("name", "Trophée")
                .attach("image", Buffer.from("x"), { filename: "a.png", contentType: "image/png" })
                .expect(400);
        });

        test("refuse à qui ne gère pas les emojis", async () => {
            on("access.guildPermission", () => [{ ownerId: 99, effect: "deny" }]);

            await auth(request(app).post("/api/v1/guilds/4/emojis"))
                .field("name", "trophee")
                .attach("image", Buffer.from("x"), { filename: "a.png", contentType: "image/png" })
                .expect(403);
        });
    });

    describe("Réactions", () => {
        beforeEach(() => {
            on("access.resolveChannel", () => [{ channelId: 10, type: "text", guildId: 4, friendshipId: null }]);
            on("access.channelPermission", () => [{ ownerId: 1, baseEffect: null, targetType: null, overrideEffect: null }]);
            allowWrite();
            on("messages.channelOf", () => ({ channelId: 10 }));
            on("reactions.add", () => ({ affectedRows: 1 }));
            on("reactions.forMessages", () => []);
        });

        const react = (emoji) =>
            auth(request(app).post("/api/v1/channels/10/messages/900/reactions")).send({ emoji });

        test("accepte un emoji personnalisé qui existe", async () => {
            on("emojis.findByName", () => ({ emojiId: 7, guildId: 4, name: "trophee", url: "/e/7.png" }));

            await react(":trophee:").expect(201);
        });

        test("refuse un emoji personnalisé inconnu de la communauté", async () => {
            on("emojis.findByName", () => null);

            await react(":inexistant:").expect(400);
        });

        test("un emoji Unicode passe sans interroger la base", async () => {
            on("emojis.findByName", () => {
                throw new Error("aucune résolution ne doit avoir lieu pour un emoji Unicode");
            });

            await react("🏆").expect(201);
        });
    });

    describe("Résolution à l'affichage", () => {
        test("les emojis cités sont rendus à part du texte", async () => {
            on("messages.listByChannel", () => [
                {
                    messageId: "900",
                    channelId: 10,
                    content: "bravo :trophee:",
                    createdAt: new Date(),
                    userId: 2,
                    handle: "bob",
                    displayName: "Bob",
                    avatar: null,
                },
            ]);
            on("reactions.forMessages", () => []);
            on("attachments.listForMessages", () => []);
            on("access.resolveChannel", () => [{ channelId: 10, type: "text", guildId: 4, friendshipId: null }]);
            on("access.channelPermission", () => [{ ownerId: 1, baseEffect: null, targetType: null, overrideEffect: null }]);
            on("emojis.findByNames", () => [{ emojiId: 7, name: "trophee", url: "/e/7.png" }]);

            const response = await auth(request(app).get("/api/v1/channels/10/messages")).expect(200);

            expect(response.body.messages[0].content).toBe("bravo :trophee:");
            expect(response.body.emojis).toEqual([
                expect.objectContaining({ name: "trophee", url: "/e/7.png" }),
            ]);
        });

        test("un message privé n'interroge aucun emoji de communauté", async () => {
            on("access.resolveChannel", () => [{ channelId: 30, type: "text", guildId: null, friendshipId: 5 }]);
            on("access.channelPermission", () => [{ ownerId: 1, baseEffect: null, targetType: null, overrideEffect: null }]);
            on("messages.listByChannel", () => []);
            on("reactions.forMessages", () => []);
            on("attachments.listForMessages", () => []);
            on("emojis.findByNames", () => {
                throw new Error("un message privé n'appartient à aucune communauté");
            });

            const response = await auth(request(app).get("/api/v1/channels/30/messages")).expect(200);

            expect(response.body.emojis).toEqual([]);
        });
    });
});

describe("Autocollants et GIFs", () => {
    const alice = makeUser({ userId: 1, handle: "alice" });
    const app = createApp();
    let token;

    beforeEach(() => {
        token = authenticateAs(alice);
        on("guilds.findById", () => [{ guildId: 4, name: "Laguna", ownerId: 1 }]);
        on("access.guildRole", () => [{ role: "owner" }]);
        on("access.guildPermission", () => [{ ownerId: 1, effect: "allow" }]);
    });

    const auth = (call) => call.set("Authorization", token(alice));

    test("les trois usages partagent un seul chemin", () => {
        expect(Object.keys(emojiService.KINDS)).toEqual(["emoji", "sticker", "gif", "sound"]);
    });

    test("chaque usage a ses propres limites", () => {
        const { emoji, sticker, gif } = emojiService.KINDS;

        expect(emoji.maxBytes).toBeLessThan(sticker.maxBytes);
        expect(sticker.maxBytes).toBeLessThan(gif.maxBytes);
    });

    test("un autocollant animé est refusé", async () => {
        await auth(request(app).post("/api/v1/guilds/4/emojis"))
            .field("name", "salut")
            .field("kind", "sticker")
            .attach("image", Buffer.from("x"), { filename: "a.gif", contentType: "image/gif" })
            .expect(400);
    });

    test("la lecture peut se limiter à un usage", async () => {
        let asked = null;
        on("emojis.listByGuild", (params) => {
            asked = params;
            return [];
        });

        await auth(request(app).get("/api/v1/guilds/4/emojis?kind=sticker")).expect(200);

        expect(asked).toContain("sticker");
    });

    test("un usage inventé est refusé", async () => {
        await auth(request(app).get("/api/v1/guilds/4/emojis?kind=video")).expect(400);
    });

    test("le nom est unique par usage, pas globalement", async () => {
        let seen = null;
        on("emojis.findByName", (params) => {
            seen = params;
            return null;
        });
        on("access.resolveChannel", () => [{ channelId: 10, type: "text", guildId: 4, friendshipId: null }]);
        on("access.channelPermission", () => [{ ownerId: 1, baseEffect: null, targetType: null, overrideEffect: null }]);
        on("messages.channelOf", () => ({ channelId: 10 }));

        await auth(request(app).post("/api/v1/channels/10/messages/900/reactions"))
            .send({ emoji: ":trophee:" })
            .expect(400);

        expect(seen).toContain("emoji");
    });
});
