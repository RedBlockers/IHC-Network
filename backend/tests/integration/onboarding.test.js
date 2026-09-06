"use strict";

const request = require("supertest");

const createApp = require("../../src/app");
const { on } = require("../helpers/db");
const { makeUser, authenticateAs } = require("../helpers/auth");
const { allowWrite } = require("../helpers/writePath");

const GUILD = 7;
const member = makeUser({ userId: 5, handle: "arrivant" });
const owner = makeUser({ userId: 1, handle: "proprio" });

function asMember() {
    on("guilds.findById", () => ({ guildId: GUILD, ownerId: 1, name: "Atelier" }));
    on("access.guildRole", () => ({ role: "member" }));
    return authenticateAs(member, owner)(member);
}

function asOwner() {
    on("guilds.findById", () => ({ guildId: GUILD, ownerId: 1, name: "Atelier" }));
    on("access.guildPermission", () => [{ ownerId: 1, effect: "allow" }]);
    on("access.guildRole", () => ({ role: "owner" }));
    return authenticateAs(member, owner)(owner);
}

function allowChannelFor(user) {
    on("access.resolveChannel", () => ({ channelId: 10, guildId: GUILD, type: "text", name: "général", position: 0 }));
    on("access.channelPermission", () => [{ ownerId: 1, baseEffect: "allow", targetType: null, overrideEffect: null }]);
    on("access.guildRole", () => ({ role: "member" }));
    allowWrite();
    return authenticateAs(member, owner)(user);
}

describe("Accueil de la communauté", () => {
    it("refuse d'activer un accueil sans règlement à lire", async () => {
        const authorization = asOwner();

        const response = await request(createApp())
            .put(`/api/v1/guilds/${GUILD}/onboarding`)
            .set("Authorization", authorization)
            .send({ enabled: true, rules: "   ", questions: [] });

        expect(response.status).toBe(400);
        expect(response.body.error.message).toBe("Un onboarding actif a besoin d'un règlement à lire.");
    });

    it("remplace la configuration d'un bloc, questions comprises", async () => {
        const authorization = asOwner();

        let config = null;
        let deleted = false;
        const questions = [];
        const options = [];
        on("onboarding.upsertConfig", (params) => {
            config = params;
            return { affectedRows: 1 };
        });
        on("onboarding.deleteQuestions", () => {
            deleted = true;
            return { affectedRows: 2 };
        });
        on("onboarding.createQuestion", (params) => {
            questions.push(params);
            return { insertId: 40 + questions.length };
        });
        on("onboarding.createOption", (params) => {
            options.push(params);
            return { affectedRows: 1 };
        });
        on("onboarding.findConfig", () => ({ guildId: GUILD, enabled: 1, rules: "Soyez courtois.", quarantineMinutes: 30 }));
        on("onboarding.listQuestions", () => []);

        const response = await request(createApp())
            .put(`/api/v1/guilds/${GUILD}/onboarding`)
            .set("Authorization", authorization)
            .send({
                enabled: true,
                rules: "Soyez courtois.",
                quarantineMinutes: 30,
                questions: [{ prompt: "Ce qui vous amène ?", options: [{ label: "Construire", roleId: 9 }, { label: "Discuter" }] }],
            });

        expect(response.status).toBe(200);
        expect(config).toEqual([GUILD, 1, "Soyez courtois.", 30]);
        expect(deleted).toBe(true);
        expect(questions).toHaveLength(1);
        expect(options).toHaveLength(2);
        expect(options[0][2]).toBe(9);
        expect(options[1][2]).toBeNull();
    });

    it("laisse lire mais refuse d'écrire tant que le règlement n'est pas accepté", async () => {
        const authorization = allowChannelFor(member);
        on("onboarding.findConfig", () => ({ guildId: GUILD, enabled: 1, rules: "Soyez courtois.", quarantineMinutes: 0 }));
        on("onboarding.findCompletion", () => null);
        on("onboarding.joinedAt", () => ({ joinedAt: new Date() }));

        const response = await request(createApp())
            .post("/api/v1/channels/10/messages")
            .set("Authorization", authorization)
            .send({ content: "bonjour tout le monde" });

        expect(response.status).toBe(403);
        expect(response.body.error.details.onboarding).toBe("pending");
    });

    it("refuse encore d'écrire pendant la quarantaine, règlement accepté", async () => {
        const authorization = allowChannelFor(member);
        on("onboarding.findConfig", () => ({ guildId: GUILD, enabled: 1, rules: "Soyez courtois.", quarantineMinutes: 60 }));
        on("onboarding.findCompletion", () => ({ acceptedAt: new Date() }));
        on("onboarding.joinedAt", () => ({ joinedAt: new Date() }));

        const response = await request(createApp())
            .post("/api/v1/channels/10/messages")
            .set("Authorization", authorization)
            .send({ content: "bonjour tout le monde" });

        expect(response.status).toBe(403);
        expect(response.body.error.details.onboarding).toBe("quarantine");
    });

    it("laisse écrire une fois la quarantaine écoulée", async () => {
        const authorization = allowChannelFor(member);
        on("onboarding.findConfig", () => ({ guildId: GUILD, enabled: 1, rules: "Soyez courtois.", quarantineMinutes: 60 }));
        on("onboarding.findCompletion", () => ({ acceptedAt: new Date() }));
        on("onboarding.joinedAt", () => ({ joinedAt: new Date(Date.now() - 2 * 3_600_000) }));
        on("messages.create", () => ({}));
        on("messages.findById", () => ({
            messageId: "800", channelId: 10, content: "bonjour tout le monde", createdAt: new Date(),
            editedAt: null, encryptionEpoch: null, userId: 5, handle: "arrivant", displayName: "Arrivant", avatar: null,
        }));

        const response = await request(createApp())
            .post("/api/v1/channels/10/messages")
            .set("Authorization", authorization)
            .send({ content: "bonjour tout le monde" });

        expect(response.status).toBe(201);
    });

    it("n'impose rien quand l'accueil est désactivé", async () => {
        const authorization = allowChannelFor(member);
        on("onboarding.findConfig", () => ({ guildId: GUILD, enabled: 0, rules: "", quarantineMinutes: 0 }));
        on("messages.create", () => ({}));
        on("messages.findById", () => ({
            messageId: "801", channelId: 10, content: "salut", createdAt: new Date(),
            editedAt: null, encryptionEpoch: null, userId: 5, handle: "arrivant", displayName: "Arrivant", avatar: null,
        }));

        const response = await request(createApp())
            .post("/api/v1/channels/10/messages")
            .set("Authorization", authorization)
            .send({ content: "salut" });

        expect(response.status).toBe(201);
    });

    it("exige l'acceptation explicite du règlement", async () => {
        const authorization = asMember();

        const response = await request(createApp())
            .post(`/api/v1/guilds/${GUILD}/onboarding/complete`)
            .set("Authorization", authorization)
            .send({ accepted: false, optionIds: [] });

        expect(response.status).toBe(400);
    });

    it("attribue les rôles des intérêts déclarés", async () => {
        const authorization = asMember();
        on("onboarding.findConfig", () => ({ guildId: GUILD, enabled: 1, rules: "Soyez courtois.", quarantineMinutes: 0 }));
        on("onboarding.findOptionsForGuild", () => [{ optionId: 21, roleId: 9 }, { optionId: 22, roleId: null }]);
        on("onboarding.complete", () => ({ affectedRows: 1 }));
        on("onboarding.findCompletion", () => ({ acceptedAt: new Date() }));
        on("onboarding.joinedAt", () => ({ joinedAt: new Date() }));
        on("roles.listForMember", () => []);

        const assigned = [];
        on("roles.assign", (params) => {
            assigned.push(params);
            return { affectedRows: 1 };
        });

        const response = await request(createApp())
            .post(`/api/v1/guilds/${GUILD}/onboarding/complete`)
            .set("Authorization", authorization)
            .send({ accepted: true, optionIds: [21, 22] });

        expect(response.status).toBe(200);
        expect(assigned).toEqual([[GUILD, 5, GUILD, 9]]);
        expect(response.body.status.completed).toBe(true);
    });

    it("refuse une réponse qui appartient à une autre communauté", async () => {
        const authorization = asMember();
        on("onboarding.findConfig", () => ({ guildId: GUILD, enabled: 1, rules: "Soyez courtois.", quarantineMinutes: 0 }));
        on("onboarding.findOptionsForGuild", () => [{ optionId: 21, roleId: 9 }]);

        const response = await request(createApp())
            .post(`/api/v1/guilds/${GUILD}/onboarding/complete`)
            .set("Authorization", authorization)
            .send({ accepted: true, optionIds: [21, 99] });

        expect(response.status).toBe(400);
        expect(response.body.error.message).toBe("Réponse inconnue pour cette communauté.");
    });
});
