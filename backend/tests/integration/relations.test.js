"use strict";

const request = require("supertest");

const createApp = require("../../src/app");
const { on } = require("../helpers/db");
const { makeUser, authenticateAs } = require("../helpers/auth");

const alice = makeUser({ userId: 1, handle: "alice" });
const bob = makeUser({ userId: 2, handle: "bob", displayName: "Bob" });
const GUILD = 7;

const authAs = (user) => authenticateAs(alice, bob)(user);

function allowChannel() {
    on("access.resolveChannel", () => ({ channelId: 10, guildId: GUILD, type: "text", name: "général", position: 0 }));
    on("access.channelPermission", () => [{ ownerId: 1, baseEffect: "allow", targetType: null, overrideEffect: null }]);
    on("access.guildRole", () => ({ role: "member" }));
}

describe("Blocage et notes personnelles", () => {
    it("refuse de se bloquer soi-même", async () => {
        const response = await request(createApp())
            .put("/api/v1/users/1/block")
            .set("Authorization", authAs(alice));

        expect(response.status).toBe(400);
    });

    it("bloque, rompt l'amitié existante et n'émet rien vers la personne bloquée", async () => {
        const realtime = require("../../src/realtime");
        realtime.__reset();

        const authorization = authAs(alice);
        on("relations.block", () => ({ affectedRows: 1 }));
        on("friendships.listForUser", () => [{ friendshipId: 4, userId: 2, status: "accepted", requesterId: 1 }]);
        on("friendships.remove", () => ({ affectedRows: 1 }));
        on("relations.listBlocked", () => [{ userId: 2, handle: "bob", displayName: "Bob", avatar: null, createdAt: new Date() }]);

        const response = await request(createApp())
            .put("/api/v1/users/2/block")
            .set("Authorization", authorization);

        expect(response.status).toBe(201);
        expect(response.body.blocked[0].handle).toBe("bob");
        const towardsBlocked = realtime.__emissions.filter((e) => e.target === "user" && e.userId === 2);
        expect(towardsBlocked).toEqual([]);
    });

    it("refuse une demande d'ami en cas de blocage, sans révéler qu'il existe", async () => {
        on("users.findByHandle", () => ({ userId: 2, handle: "bob", displayName: "Bob" }));
        on("relations.isBlockedEitherWay", () => ({ ok: 1 }));

        const response = await request(createApp())
            .post("/api/v1/friends/bob")
            .set("Authorization", authAs(alice));

        expect(response.status).toBe(404);
        expect(response.body.error.message).toBe("Utilisateur introuvable.");
    });

    it("garde la note de contact privée à son auteur", async () => {
        let stored = null;
        on("relations.upsertNote", (params) => {
            stored = params;
            return { affectedRows: 1 };
        });
        on("relations.findNote", () => ({ body: "rencontré au festival", updatedAt: new Date() }));

        const response = await request(createApp())
            .put("/api/v1/users/2/note")
            .set("Authorization", authAs(alice))
            .send({ body: "rencontré au festival" });

        expect(response.status).toBe(200);
        expect(stored).toEqual([1, 2, "rencontré au festival"]);
        expect(response.body.note.body).toBe("rencontré au festival");
    });

    it("efface la note quand elle est vidée", async () => {
        let deleted = null;
        on("relations.deleteNote", (params) => {
            deleted = params;
            return { affectedRows: 1 };
        });

        const response = await request(createApp())
            .put("/api/v1/users/2/note")
            .set("Authorization", authAs(alice))
            .send({ body: "   " });

        expect(response.status).toBe(200);
        expect(deleted).toEqual([1, 2]);
        expect(response.body.note).toBeNull();
    });
});

describe("File de signalements", () => {
    it("refuse un signalement sans motif exploitable", async () => {
        allowChannel();

        const response = await request(createApp())
            .post("/api/v1/channels/10/messages/500/report")
            .set("Authorization", authAs(alice))
            .send({ reason: "x" });

        expect(response.status).toBe(400);
    });

    it("n'accepte un signalement que sur un message du salon", async () => {
        allowChannel();
        on("messages.channelOf", () => ({ channelId: 99 }));

        const response = await request(createApp())
            .post("/api/v1/channels/10/messages/500/report")
            .set("Authorization", authAs(alice))
            .send({ reason: "propos haineux répétés" });

        expect(response.status).toBe(404);
    });

    it("enregistre le signalement sans prévenir l'auteur du message", async () => {
        const realtime = require("../../src/realtime");
        realtime.__reset();
        allowChannel();
        on("messages.channelOf", () => ({ channelId: 10 }));

        let created = null;
        on("reports.create", (params) => {
            created = params;
            return { insertId: 3 };
        });

        const response = await request(createApp())
            .post("/api/v1/channels/10/messages/500/report")
            .set("Authorization", authAs(alice))
            .send({ reason: "propos haineux répétés" });

        expect(response.status).toBe(201);
        expect(created).toEqual([GUILD, 10, "500", 1, "propos haineux répétés"]);
        expect(realtime.__emissions.every((e) => e.target !== "user")).toBe(true);
    });

    it("replace le message signalé dans son échange", async () => {
        on("guilds.findById", () => ({ guildId: GUILD, ownerId: 1, name: "Atelier" }));
        on("access.guildPermission", () => [{ ownerId: 1, effect: "allow" }]);
        on("access.guildRole", () => ({ role: "admin" }));
        on("reports.findById", () => ({ reportId: 3, guildId: GUILD, channelId: 10, messageId: "500" }));

        let span = null;
        on("reports.contextAround", (params) => {
            span = params;
            return [
                { messageId: "501", content: "après", createdAt: new Date(), userId: 2, handle: "bob", displayName: "Bob", avatar: null },
                { messageId: "499", content: "avant", createdAt: new Date(), userId: 2, handle: "bob", displayName: "Bob", avatar: null },
                { messageId: "500", content: "le message", createdAt: new Date(), userId: 2, handle: "bob", displayName: "Bob", avatar: null },
            ];
        });

        const response = await request(createApp())
            .get(`/api/v1/guilds/${GUILD}/reports/3/context`)
            .set("Authorization", authAs(alice));

        expect(response.status).toBe(200);
        expect(span).toEqual([10, "500", 3, 10, "500", 3]);
        expect(response.body.context.map((entry) => entry.messageId)).toEqual(["499", "500", "501"]);
    });

    it("exige une raison pour clore un signalement et la consigne à l'audit", async () => {
        on("guilds.findById", () => ({ guildId: GUILD, ownerId: 1, name: "Atelier" }));
        on("access.guildPermission", () => [{ ownerId: 1, effect: "allow" }]);
        on("access.guildRole", () => ({ role: "admin" }));

        const empty = await request(createApp())
            .patch(`/api/v1/guilds/${GUILD}/reports/3`)
            .set("Authorization", authAs(alice))
            .send({ status: "resolved", resolution: "" });
        expect(empty.status).toBe(400);

        on("reports.resolve", () => ({ affectedRows: 1 }));
        let audit = null;
        on("moderation.appendAudit", (params) => {
            audit = params;
            return { insertId: 9 };
        });

        const response = await request(createApp())
            .patch(`/api/v1/guilds/${GUILD}/reports/3`)
            .set("Authorization", authAs(alice))
            .send({ status: "rejected", resolution: "message conforme au règlement" });

        expect(response.status).toBe(200);
        expect(audit[2]).toBe("report.rejected");
        expect(audit[5]).toBe("message conforme au règlement");
    });
});
