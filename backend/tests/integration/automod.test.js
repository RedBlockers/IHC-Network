"use strict";

const request = require("supertest");

const createApp = require("../../src/app");
const { on } = require("../helpers/db");
const { makeUser, authenticateAs } = require("../helpers/auth");
const { allowWrite } = require("../helpers/writePath");

const GUILD = 7;
const user = makeUser({ userId: 5, handle: "membre" });

function allowChannel() {
    on("access.resolveChannel", () => ({ channelId: 10, guildId: GUILD, type: "text", name: "général", position: 0 }));
    on("access.channelPermission", () => [{ ownerId: 1, baseEffect: "allow", targetType: null, overrideEffect: null }]);
    on("access.guildRole", () => ({ role: "member" }));
    allowWrite();
    return authenticateAs(user)(user);
}

const sent = () => ({
    messageId: "900", channelId: 10, content: "bonjour", createdAt: new Date(), editedAt: null,
    encryptionEpoch: null, userId: 5, handle: "membre", displayName: "Membre", avatar: null,
});

describe("Filtres automatiques appliqués à l'envoi", () => {
    it("laisse passer quand les filtres sont désactivés", async () => {
        const authorization = allowChannel();
        on("automod.findConfig", () => ({ guildId: GUILD, enabled: 0, blockedWords: "arnaque", blockedDomains: "" }));
        on("messages.create", () => ({}));
        on("messages.findById", () => sent());

        const response = await request(createApp())
            .post("/api/v1/channels/10/messages")
            .set("Authorization", authorization)
            .send({ content: "c'est une arnaque" });

        expect(response.status).toBe(201);
    });

    it("refuse le message et journalise la raison quand la mesure est le refus", async () => {
        const authorization = allowChannel();
        on("automod.findConfig", () => ({
            guildId: GUILD, enabled: 1, blockedWords: "arnaque", blockedDomains: "",
            spamMessages: 0, spamSeconds: 0, raidJoins: 0, raidSeconds: 0, action: "delete",
        }));

        let audit = null;
        on("moderation.appendAudit", (params) => {
            audit = params;
            return { insertId: 1 };
        });

        const response = await request(createApp())
            .post("/api/v1/channels/10/messages")
            .set("Authorization", authorization)
            .send({ content: "c'est une arnaque totale" });

        expect(response.status).toBe(403);
        expect(response.body.error.message).toBe(
            "Le message contient un terme filtré par la communauté (« arnaque »)."
        );
        expect(response.body.error.details.automod).toBe("words");
        expect(audit[2]).toBe("automod.words");
        expect(audit[5]).toContain("message refusé");
    });

    it("laisse passer le message mais le signale quand la mesure est le signalement", async () => {
        const authorization = allowChannel();
        on("automod.findConfig", () => ({
            guildId: GUILD, enabled: 1, blockedWords: "arnaque", blockedDomains: "",
            spamMessages: 0, spamSeconds: 0, raidJoins: 0, raidSeconds: 0, action: "flag",
        }));
        let audit = null;
        on("moderation.appendAudit", (params) => {
            audit = params;
            return { insertId: 1 };
        });
        on("messages.create", () => ({}));
        on("messages.findById", () => sent());

        const response = await request(createApp())
            .post("/api/v1/channels/10/messages")
            .set("Authorization", authorization)
            .send({ content: "c'est une arnaque totale" });

        expect(response.status).toBe(201);
        expect(audit[5]).toContain("signalé à l'équipe");
    });

    it("refuse un domaine filtré, sous-domaine compris", async () => {
        const authorization = allowChannel();
        on("automod.findConfig", () => ({
            guildId: GUILD, enabled: 1, blockedWords: "", blockedDomains: "exemple-arnaque.fr",
            spamMessages: 0, spamSeconds: 0, raidJoins: 0, raidSeconds: 0, action: "delete",
        }));
        on("moderation.appendAudit", () => ({ insertId: 1 }));

        const response = await request(createApp())
            .post("/api/v1/channels/10/messages")
            .set("Authorization", authorization)
            .send({ content: "clique ici https://promo.exemple-arnaque.fr/gagner" });

        expect(response.status).toBe(403);
        expect(response.body.error.details.automod).toBe("domains");
    });

    it("n'agit pas sur un message ordinaire malgré des filtres actifs", async () => {
        const authorization = allowChannel();
        on("automod.findConfig", () => ({
            guildId: GUILD, enabled: 1, blockedWords: "arnaque", blockedDomains: "exemple-arnaque.fr",
            spamMessages: 0, spamSeconds: 0, raidJoins: 0, raidSeconds: 0, action: "delete",
        }));
        on("moderation.appendAudit", () => {
            throw new Error("aucun audit ne doit être écrit");
        });
        on("messages.create", () => ({}));
        on("messages.findById", () => sent());

        const response = await request(createApp())
            .post("/api/v1/channels/10/messages")
            .set("Authorization", authorization)
            .send({ content: "la taverne ouvre à 21 h" });

        expect(response.status).toBe(201);
    });
});
