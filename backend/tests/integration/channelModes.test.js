"use strict";

const request = require("supertest");

const createApp = require("../../src/app");
const { on } = require("../helpers/db");
const { makeUser, authenticateAs } = require("../helpers/auth");
const { allowWrite } = require("../helpers/writePath");

const user = makeUser({ userId: 5, handle: "membre" });

function channelOfType(type, { canManage = true } = {}) {
    on("access.resolveChannel", () => ({ channelId: 10, guildId: 7, type, name: "salon", position: 0 }));
    on("access.channelPermission", (params) => [{
        ownerId: 99,
        baseEffect: params[1] === "MANAGE_MESSAGES" && !canManage ? "deny" : "allow",
        targetType: null,
        overrideEffect: null,
    }]);
    on("access.guildRole", () => ({ role: "member" }));
    allowWrite();
    return authenticateAs(user)(user);
}

const created = (content) => ({
    messageId: "900", channelId: 10, content, createdAt: new Date(), editedAt: null,
    encryptionEpoch: null, userId: 5, handle: "membre", displayName: "Membre", avatar: null,
});

describe("Modes de salon", () => {
    it("refuse un message écrit dans un salon vocal", async () => {
        const authorization = channelOfType("voice");

        const response = await request(createApp())
            .post("/api/v1/channels/10/messages")
            .set("Authorization", authorization)
            .send({ content: "bonjour" });

        expect(response.status).toBe(400);
        expect(response.body.error.message).toMatch(/vocal/);
    });

    it("réserve la publication dans un salon d'annonces mais dit ce qui reste possible", async () => {
        const authorization = channelOfType("announcement", { canManage: false });

        const response = await request(createApp())
            .post("/api/v1/channels/10/messages")
            .set("Authorization", authorization)
            .send({ content: "annonce non autorisée" });

        expect(response.status).toBe(403);
        expect(response.body.error.message).toMatch(/réagir/);
        expect(response.body.error.details.mode).toBe("announcement");
    });

    it("laisse publier une annonce à qui en a le droit", async () => {
        const authorization = channelOfType("announcement", { canManage: true });
        on("messages.create", () => ({}));
        on("messages.findById", () => created("annonce officielle"));

        const response = await request(createApp())
            .post("/api/v1/channels/10/messages")
            .set("Authorization", authorization)
            .send({ content: "annonce officielle" });

        expect(response.status).toBe(201);
    });

    it("refuse un message de premier niveau dans un forum", async () => {
        const authorization = channelOfType("forum");

        const response = await request(createApp())
            .post("/api/v1/channels/10/messages")
            .set("Authorization", authorization)
            .send({ content: "je poste comme dans un salon texte" });

        expect(response.status).toBe(400);
        expect(response.body.error.message).toMatch(/ouvrez un sujet/);
    });

    it("ouvre un sujet de forum : message racine et fil naissent ensemble", async () => {
        const authorization = channelOfType("forum");
        let threadCreated = null;
        on("messages.create", () => ({}));
        on("messages.findById", () => created("comment poser la charpente ?"));
        on("threads.create", (params) => {
            threadCreated = params;
            return { affectedRows: 1 };
        });
        on("threads.follow", () => ({ affectedRows: 1 }));
        on("threads.findByRoot", () => ({
            rootId: "900", channelId: 10, title: "Charpente", createdBy: 5,
            createdAt: new Date(), lastMessageAt: new Date(), replyCount: 0, autoArchiveMinutes: 4320,
        }));

        const response = await request(createApp())
            .post("/api/v1/channels/10/topics")
            .set("Authorization", authorization)
            .send({ title: "Charpente", content: "comment poser la charpente ?" });

        expect(response.status).toBe(201);
        expect(threadCreated[0]).toBe("900");
        expect(response.body.thread.following).toBe(true);
    });
});

describe("Sondages", () => {
    it("refuse un sondage sans deux réponses distinctes", async () => {
        const authorization = channelOfType("poll");

        const tooFew = await request(createApp())
            .post("/api/v1/channels/10/polls")
            .set("Authorization", authorization)
            .send({ question: "Quel thème ?", options: ["Un seul"] });
        expect(tooFew.status).toBe(400);

        const duplicated = await request(createApp())
            .post("/api/v1/channels/10/polls")
            .set("Authorization", authorization)
            .send({ question: "Quel thème ?", options: ["Masques", "masques"] });
        expect(duplicated.status).toBe(400);
        expect(duplicated.body.error.message).toMatch(/identiques/);
    });

    it("crée le sondage sur un vrai message et rend un décompte à zéro", async () => {
        const authorization = channelOfType("poll");
        on("messages.create", () => ({}));
        on("messages.findById", () => created("Quel thème pour le bal ?"));
        on("polls.create", () => ({ insertId: 3 }));
        on("polls.createOption", () => ({ affectedRows: 1 }));
        on("polls.findByMessage", () => ({
            pollId: 3, channelId: 10, messageId: "900", question: "Quel thème pour le bal ?",
            anonymous: 1, closesAt: null, closedAt: null, createdBy: 5,
        }));
        on("polls.listOptions", () => [
            { optionId: 11, label: "Masques", position: 0 },
            { optionId: 12, label: "Lucioles", position: 1 },
        ]);
        on("polls.tally", () => []);
        on("polls.voteOf", () => null);

        const response = await request(createApp())
            .post("/api/v1/channels/10/polls")
            .set("Authorization", authorization)
            .send({ question: "Quel thème pour le bal ?", options: ["Masques", "Lucioles"] });

        expect(response.status).toBe(201);
        expect(response.body.poll.totalVotes).toBe(0);
        expect(response.body.poll.options[0].share).toBe(0);
        expect(response.body.poll.yourVote).toBeNull();
    });

    it("remplace la voix au lieu d'en ajouter une seconde", async () => {
        const authorization = channelOfType("poll");
        on("polls.findByMessage", () => ({
            pollId: 3, channelId: 10, messageId: "900", question: "Quel thème ?",
            anonymous: 1, closesAt: null, closedAt: null, createdBy: 9,
        }));
        on("polls.optionBelongs", () => ({ ok: 1 }));
        let vote = null;
        on("polls.vote", (params) => {
            vote = params;
            return { affectedRows: 1 };
        });
        on("polls.listOptions", () => [{ optionId: 11, label: "Masques", position: 0 }, { optionId: 12, label: "Lucioles", position: 1 }]);
        on("polls.tally", () => [{ optionId: 12, votes: 1 }]);
        on("polls.voteOf", () => ({ optionId: 12 }));

        const response = await request(createApp())
            .put("/api/v1/channels/10/polls/900/vote")
            .set("Authorization", authorization)
            .send({ optionId: 12 });

        expect(response.status).toBe(200);
        expect(vote).toEqual([3, 5, 12]);
        expect(response.body.poll.yourVote).toBe(12);
        expect(response.body.poll.options[1].share).toBe(100);
    });

    it("refuse une réponse qui n'appartient pas au sondage", async () => {
        const authorization = channelOfType("poll");
        on("polls.findByMessage", () => ({
            pollId: 3, channelId: 10, messageId: "900", question: "Quel thème ?",
            anonymous: 1, closesAt: null, closedAt: null, createdBy: 9,
        }));
        on("polls.optionBelongs", () => null);

        const response = await request(createApp())
            .put("/api/v1/channels/10/polls/900/vote")
            .set("Authorization", authorization)
            .send({ optionId: 99 });

        expect(response.status).toBe(400);
    });

    it("refuse de voter dans un sondage échu", async () => {
        const authorization = channelOfType("poll");
        on("polls.findByMessage", () => ({
            pollId: 3, channelId: 10, messageId: "900", question: "Quel thème ?",
            anonymous: 1, closesAt: new Date(Date.now() - 3_600_000), closedAt: null, createdBy: 9,
        }));

        const response = await request(createApp())
            .put("/api/v1/channels/10/polls/900/vote")
            .set("Authorization", authorization)
            .send({ optionId: 12 });

        expect(response.status).toBe(403);
        expect(response.body.error.message).toMatch(/clos/);
    });

    it("ne laisse clore un sondage qu'à son auteur", async () => {
        const authorization = channelOfType("poll");
        on("polls.findByMessage", () => ({
            pollId: 3, channelId: 10, messageId: "900", question: "Quel thème ?",
            anonymous: 1, closesAt: null, closedAt: null, createdBy: 9,
        }));
        on("polls.close", () => ({ affectedRows: 0 }));

        const response = await request(createApp())
            .delete("/api/v1/channels/10/polls/900")
            .set("Authorization", authorization);

        expect(response.status).toBe(403);
    });
});
