"use strict";

const request = require("supertest");

const createApp = require("../../src/app");
const { on } = require("../helpers/db");
const { makeUser, authenticateAs } = require("../helpers/auth");
const { allowWrite } = require("../helpers/writePath");

const ada = makeUser({ userId: 5, handle: "ada" });

function textChannel() {
    on("access.resolveChannel", () => ({
        channelId: 10,
        guildId: 7,
        type: "text",
        name: "général",
        position: 0,
        e2eeEnabled: 0,
    }));
    on("access.channelPermission", () => [{ ownerId: 99, baseEffect: "allow", targetType: null, overrideEffect: null }]);
    on("access.guildRole", () => ({ role: "member" }));
    allowWrite();
    return authenticateAs(ada)(ada);
}

describe("Compléments communauté", () => {
    it("persiste un trait de tableau", async () => {
        const authorization = textChannel();
        on("collab.addStroke", () => ({ insertId: 4 }));

        const response = await request(createApp())
            .post("/api/v1/channels/10/whiteboard")
            .set("Authorization", authorization)
            .send({ color: "#7c9cff", points: [{ x: 1, y: 1 }, { x: 4, y: 6 }] });

        expect(response.status).toBe(201);
        expect(response.body.stroke.strokeId).toBe(4);
    });

    it("refuse une transcription sans consentement", async () => {
        const authorization = textChannel();
        const response = await request(createApp())
            .post("/api/v1/channels/10/transcripts")
            .set("Authorization", authorization)
            .send({ text: "bonjour", consented: false });

        expect(response.status).toBe(400);
    });

    it("classe la recherche sémantique par recouvrement lexical", async () => {
        const authorization = authenticateAs(ada)(ada);
        on("guilds.listIdsForUser", () => [{ guildId: 7 }]);
        on("channels.listDirectForUser", () => []);
        on("channels.listByGuild", () => [
            { channelId: 10, guildId: 7, type: "text", name: "général", e2eeEnabled: 0 },
        ]);
        on("access.channelPermission", () => [{ ownerId: 99, baseEffect: "allow", targetType: null, overrideEffect: null }]);
        on("search.recent", () => [
            {
                messageId: "1",
                channelId: 10,
                content: "la revue du worktree est prête",
                createdAt: new Date(),
                userId: 5,
                handle: "ada",
                displayName: "Ada",
                avatar: null,
                channelName: "général",
                channelType: "text",
            },
            {
                messageId: "2",
                channelId: 10,
                content: "bonjour tout le monde",
                createdAt: new Date(),
                userId: 5,
                handle: "ada",
                displayName: "Ada",
                avatar: null,
                channelName: "général",
                channelType: "text",
            },
        ]);

        const response = await request(createApp())
            .get("/api/v1/search/semantic?q=revue%20worktree")
            .set("Authorization", authorization);

        expect(response.status).toBe(200);
        expect(response.body.method).toBe("lexical-overlap");
        expect(response.body.results[0].content).toMatch(/worktree/);
    });

    it("enregistre une transcription seulement avec consentement", async () => {
        const authorization = textChannel();
        on("collab.addTranscript", () => ({ insertId: 8 }));

        const response = await request(createApp())
            .post("/api/v1/channels/10/transcripts")
            .set("Authorization", authorization)
            .send({ text: "on avance sur la revue", consented: true });

        expect(response.status).toBe(201);
        expect(response.body.transcript.text).toMatch(/revue/);
    });

    it("refuse un résumé sans opt-in", async () => {
        const authorization = textChannel();
        const response = await request(createApp())
            .post("/api/v1/channels/10/summary")
            .set("Authorization", authorization)
            .send({});

        expect(response.status).toBe(400);
    });

    it("produit un résumé extractif nommé", async () => {
        const authorization = textChannel();
        on("messages.listByChannel", () => [
            { messageId: "1", content: "La revue du worktree est prête pour demain matin.", userId: 5, handle: "ada", displayName: "Ada" },
            { messageId: "2", content: "La revue du worktree avance bien aujourd'hui.", userId: 5, handle: "ada", displayName: "Ada" },
        ]);
        on("collab.addSummary", () => ({ insertId: 3 }));

        const response = await request(createApp())
            .post("/api/v1/channels/10/summary")
            .set("Authorization", authorization)
            .send({ optedIn: true });

        expect(response.status).toBe(201);
        expect(response.body.method).toBe("extractive");
        expect(response.body.body).toMatch(/revue/);
    });
});
