"use strict";

const crypto = require("node:crypto");
const jwt = require("jsonwebtoken");
const request = require("supertest");

const createApp = require("../../src/app");
const { on } = require("../helpers/db");
const { makeUser, authenticateAs } = require("../helpers/auth");

const ada = makeUser({ userId: 5, handle: "ada" });

function asOwner() {
    on("guilds.findById", () => [{ guildId: 7, name: "Laguna", ownerId: 5 }]);
    on("access.guildRole", () => [{ role: "owner" }]);
    on("access.guildPermission", () => [{ ownerId: 5, effect: "allow" }]);
    return authenticateAs(ada)(ada);
}

describe("Bots distincts des webhooks", () => {
    it("rend le secret une seule fois et poste sous botName, pas webhookName", async () => {
        const authorization = asOwner();
        on("bots.listByGuild", () => []);
        let written = null;
        on("bots.create", (params) => {
            written = params;
            return { insertId: 11 };
        });

        const created = await request(createApp())
            .post("/api/v1/guilds/7/bots")
            .set("Authorization", authorization)
            .send({ name: "Veilleur", events: ["message.created"] })
            .expect(201);

        expect(created.body.bot.token).toEqual(expect.any(String));
        expect(written).not.toContain(created.body.bot.token);
        expect(written.some((value) => typeof value === "string" && /^[0-9a-f]{64}$/.test(value))).toBe(true);

        const token = created.body.bot.token;
        const hash = crypto.createHash("sha256").update(token).digest("hex");
        on("bots.findByPublicId", () => ({
            botId: 11,
            guildId: 7,
            name: "Veilleur",
            tokenHash: hash,
            publicId: created.body.bot.publicId,
            createdBy: 5,
            revokedAt: null,
        }));
        on("bots.touch", () => ({ affectedRows: 1 }));
        on("channels.findById", () => ({ channelId: 10, guildId: 7, type: "text", name: "général" }));
        on("messages.createFromBot", () => ({ affectedRows: 1 }));
        on("messages.findById", () => ({
            messageId: "901",
            channelId: 10,
            content: "salon prêt",
            createdAt: new Date(),
            userId: 5,
            handle: "ada",
            displayName: "Ada",
            botName: "Veilleur",
        }));

        const posted = await request(createApp())
            .post(`/api/v1/bots/${created.body.bot.publicId}/messages`)
            .set("Authorization", `Bot ${token}`)
            .send({ channelId: 10, content: "salon prêt" })
            .expect(201);

        expect(posted.body.message.author.isBot).toBe(true);
        expect(posted.body.message.author.isWebhook).toBe(false);
        expect(posted.body.message.author.displayName).toBe("Veilleur");
        expect(posted.body.message.content).toBe("salon prêt");
        expect(posted.body.message.content).not.toMatch(/\*\*Veilleur\*\*/);
    });

    it("refuse un jeton de bot sur la route webhook, et l'inverse", async () => {
        on("webhooks.findByTokenHash", () => null);
        on("bots.findByPublicId", () => null);

        const asWebhook = await request(createApp())
            .post("/api/v1/webhooks/not-a-webhook-token-xx")
            .send({ content: "x" });
        expect(asWebhook.status).toBe(401);

        const asBot = await request(createApp())
            .post("/api/v1/bots/ffffffffffff/messages")
            .set("Authorization", "Bot not-a-bot-token")
            .send({ channelId: 10, content: "x" });
        expect(asBot.status).toBe(401);
    });
});

describe("Activités iframe signées", () => {
    it("refuse une origine qui n'est pas en HTTPS", async () => {
        const authorization = asOwner();
        const response = await request(createApp())
            .post("/api/v1/guilds/7/activities")
            .set("Authorization", authorization)
            .send({ name: "Tableau", origin: "http://jeu.example" });
        expect(response.status).toBe(400);
    });

    it("rend un jeton hors de l'URL et le vérifie", async () => {
        const authorization = asOwner();
        on("access.guildRole", () => [{ role: "member" }]);
        on("activities.find", () => [{ activityId: 4, name: "Tableau", origin: "https://jeu.example/app" }]);
        on("channels.findById", () => ({ channelId: 10, guildId: 7, type: "voice", name: "scène" }));

        const launched = await request(createApp())
            .post("/api/v1/guilds/7/activities/4/launch")
            .set("Authorization", authorization)
            .send({ channelId: 10 })
            .expect(200);

        expect(launched.body.url).toBeUndefined();
        expect(launched.body.origin).toBe("https://jeu.example/app");
        expect(launched.body.token).toEqual(expect.any(String));
        expect(launched.body.token).not.toContain("?");

        const verified = await request(createApp())
            .post("/api/v1/activities/verify")
            .send({ token: launched.body.token })
            .expect(200);

        expect(verified.body.session.activityId).toBe(4);
        expect(verified.body.session.channelId).toBe(10);
        expect(verified.body.session.userId).toBe(5);
    });

    it("refuse un jeton fabriqué", async () => {
        const fake = jwt.sign({ typ: "activity", sub: "5", activityId: 1 }, "wrong-secret", { expiresIn: "10m" });
        const response = await request(createApp()).post("/api/v1/activities/verify").send({ token: fake });
        expect(response.status).toBe(401);
    });
});

describe("Automatisations événementielles", () => {
    it("crée une règle et la désactive", async () => {
        const authorization = asOwner();
        on("channels.findById", () => ({ channelId: 12, guildId: 7, type: "text", name: "arrivées" }));
        on("automations.create", () => ({ insertId: 2 }));
        on("automations.setEnabled", () => ({ affectedRows: 1 }));

        const created = await request(createApp())
            .post("/api/v1/guilds/7/automations")
            .set("Authorization", authorization)
            .send({
                name: "Accueil",
                event: "member.joined",
                action: "post_message",
                channelId: 12,
                template: "Bienvenue @{handle}",
            })
            .expect(201);

        expect(created.body.automation.event).toBe("member.joined");

        const patched = await request(createApp())
            .patch("/api/v1/guilds/7/automations/2")
            .set("Authorization", authorization)
            .send({ enabled: false })
            .expect(200);

        expect(patched.body.enabled).toBe(false);
    });

    it("à l'acceptation d'une invitation, consulte les règles member.joined", async () => {
        const authorization = authenticateAs(ada)(ada);
        on("invites.findValidByCode", () => ({
            inviteId: 3,
            guildId: 7,
            code: "welcomeokabcdefghijklm",
        }));
        on("guilds.getMembership", () => null);
        on("moderation.findActiveSanction", () => null);
        on("invites.consume", () => ({ affectedRows: 1 }));
        on("guilds.addMember", () => ({ affectedRows: 1 }));
        on("roles.assignDefault", () => ({ affectedRows: 1 }));
        let seenEvent = null;
        on("automations.active", (params) => {
            seenEvent = params[1];
            return [];
        });

        await request(createApp())
            .post("/api/v1/invites/welcomeokabcdefghijklm/accept")
            .set("Authorization", authorization)
            .expect(200);

        expect(seenEvent).toBe("member.joined");
    });
});
