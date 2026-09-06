"use strict";

const request = require("supertest");
const createApp = require("../../src/app");
const { on } = require("../helpers/db");
const { makeUser, authenticateAs } = require("../helpers/auth");

describe("Accueil d'une communauté", () => {
    const alice = makeUser({ userId: 1, handle: "alice" });
    const app = createApp();
    let token;

    const message = (messageId, channelId, content) => ({
        messageId,
        channelId,
        content,
        createdAt: "2026-08-13T10:00:00.000Z",
        userId: 2,
        handle: "bob",
        displayName: "Bob",
        avatar: null,
    });

    beforeEach(() => {
        token = authenticateAs(alice);
        on("guilds.findById", () => [{ guildId: 7, name: "Laguna", ownerId: 1 }]);
        on("access.guildRole", () => [{ role: "member" }]);
        on("channels.listByGuild", () => [
            { channelId: 10, guildId: 7, name: "annonces", type: "announcement" },
            { channelId: 11, guildId: 7, name: "general", type: "text" },
            { channelId: 12, guildId: 7, name: "agenda", type: "event" },
            { channelId: 13, guildId: 7, name: "prive", type: "text" },
            { channelId: 14, guildId: 7, name: "vocal", type: "voice" },
        ]);
        on("access.channelPermission", (params) =>
            Number(params[2]) === 13
                ? [{ ownerId: 99, baseEffect: "deny", targetType: null, overrideEffect: null }]
                : [{ ownerId: 99, baseEffect: "allow", targetType: null, overrideEffect: null }]
        );
        on("access.resolveChannel", (params) => {
            const channelId = Number(params[0]);
            return [{ channelId, type: "text", guildId: 7, friendshipId: null }];
        });
        on("messages.latestAcrossChannels", () => [message("900", 10, "Maintenance ce soir")]);
        on("messages.latestPerChannel", () => [message("901", 11, "Salut tout le monde")]);
        on("events.upcomingForChannels", () => [
            { eventId: 5, channelId: 12, title: "Soirée jeux", startsAt: "2026-08-20T19:00:00.000Z" },
        ]);
    });

    test("rend les annonces, l'activité et les prochains rendez-vous", async () => {
        const response = await request(app)
            .get("/api/v1/guilds/7/home")
            .set("Authorization", token(alice))
            .expect(200);

        expect(response.body.announcements[0].content).toBe("Maintenance ce soir");
        expect(response.body.activity[0].channelName).toBe("general");
        expect(response.body.events[0].title).toBe("Soirée jeux");
    });

    test("n'interroge que les salons réellement visibles", async () => {
        let asked = null;
        on("messages.latestPerChannel", (params) => {
            asked = params.map(Number);
            return [];
        });

        await request(app).get("/api/v1/guilds/7/home").set("Authorization", token(alice)).expect(200);

        expect(asked).toContain(11);
        expect(asked).not.toContain(13);
    });

    test("sépare les annonces de l'activité par le type de salon", async () => {
        let announcementIds = null;
        let conversationIds = null;
        on("messages.latestAcrossChannels", (params) => {
            announcementIds = params.map(Number);
            return [];
        });
        on("messages.latestPerChannel", (params) => {
            conversationIds = params.map(Number);
            return [];
        });

        await request(app).get("/api/v1/guilds/7/home").set("Authorization", token(alice)).expect(200);

        expect(announcementIds).toContain(10);
        expect(conversationIds).not.toContain(10);
        expect(conversationIds).not.toContain(14);
    });

    test("annonce combien de salons sont accessibles", async () => {
        const response = await request(app)
            .get("/api/v1/guilds/7/home")
            .set("Authorization", token(alice))
            .expect(200);

        expect(response.body.visibleChannels).toBe(4);
    });

    test("rend des sections vides plutôt qu'une erreur quand rien n'existe", async () => {
        on("messages.latestAcrossChannels", () => []);
        on("messages.latestPerChannel", () => []);
        on("events.upcomingForChannels", () => []);

        const response = await request(app)
            .get("/api/v1/guilds/7/home")
            .set("Authorization", token(alice))
            .expect(200);

        expect(response.body.announcements).toEqual([]);
        expect(response.body.activity).toEqual([]);
        expect(response.body.events).toEqual([]);
    });

    test("refuse l'accueil à qui n'est pas membre", async () => {
        on("access.guildRole", () => []);

        await request(app).get("/api/v1/guilds/7/home").set("Authorization", token(alice)).expect(403);
    });
});
