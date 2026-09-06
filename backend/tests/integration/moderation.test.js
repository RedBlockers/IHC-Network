"use strict";

const request = require("supertest");

const createApp = require("../../src/app");
const { on } = require("../helpers/db");
const { makeUser, authenticateAs } = require("../helpers/auth");

const GUILD = 7;

function allowModerator(actor, { ownerId = 99 } = {}) {
    on("guilds.findById", () => ({ guildId: GUILD, ownerId, name: "Atelier" }));
    on("access.guildPermission", () => [{ ownerId, effect: "allow" }]);
    on("access.guildRole", () => ({ role: "admin" }));
    return authenticateAs(actor)(actor);
}

const SANCTION_ROW = {
    sanctionId: 3, guildId: GUILD, userId: 5, type: "timeout", reason: "spam répété",
    issuedBy: 1, issuedAt: new Date(Date.now() - 60_000), expiresAt: new Date(Date.now() + 3_600_000),
    revokedAt: null, revokedBy: null, revokeReason: null, appealText: null, appealedAt: null,
};

describe("Modération motivée et journal d'audit", () => {
    it("refuse une sanction sans motif", async () => {
        const actor = makeUser({ userId: 1, handle: "mod" });
        const authorization = allowModerator(actor);

        const response = await request(createApp())
            .post(`/api/v1/guilds/${GUILD}/members/5/sanctions`)
            .set("Authorization", authorization)
            .send({ type: "kick", reason: "  " });

        expect(response.status).toBe(400);
    });

    it("refuse un timeout sans durée", async () => {
        const actor = makeUser({ userId: 1, handle: "mod" });
        const authorization = allowModerator(actor);

        const response = await request(createApp())
            .post(`/api/v1/guilds/${GUILD}/members/5/sanctions`)
            .set("Authorization", authorization)
            .send({ type: "timeout", reason: "spam répété" });

        expect(response.status).toBe(400);
    });

    it("refuse de sanctionner le propriétaire de la communauté", async () => {
        const actor = makeUser({ userId: 1, handle: "mod" });
        const authorization = allowModerator(actor, { ownerId: 5 });

        const response = await request(createApp())
            .post(`/api/v1/guilds/${GUILD}/members/5/sanctions`)
            .set("Authorization", authorization)
            .send({ type: "ban", reason: "abus de pouvoir" });

        expect(response.status).toBe(403);
        expect(response.body.error.message).toBe("Le propriétaire de la communauté ne peut pas être sanctionné.");
    });

    it("refuse de sanctionner un membre situé au même niveau ou au-dessus", async () => {
        const actor = makeUser({ userId: 1, handle: "mod" });
        const authorization = allowModerator(actor);
        on("roles.highestPositionForMember", (params) => ({ position: Number(params[1]) === 1 ? 5 : 9 }));

        const response = await request(createApp())
            .post(`/api/v1/guilds/${GUILD}/members/5/sanctions`)
            .set("Authorization", authorization)
            .send({ type: "kick", reason: "comportement toxique" });

        expect(response.status).toBe(403);
        expect(response.body.error.message).toMatch(/situés sous votre rôle/);
    });

    it("refuse qu'un modérateur se sanctionne lui-même", async () => {
        const actor = makeUser({ userId: 1, handle: "mod" });
        const authorization = allowModerator(actor);

        const response = await request(createApp())
            .post(`/api/v1/guilds/${GUILD}/members/1/sanctions`)
            .set("Authorization", authorization)
            .send({ type: "kick", reason: "test" });

        expect(response.status).toBe(400);
    });

    it("écrit la sanction, sa trace d'audit et notifie le membre dans la même opération", async () => {
        const actor = makeUser({ userId: 1, handle: "mod" });
        const authorization = allowModerator(actor);
        on("roles.highestPositionForMember", (params) => ({ position: Number(params[1]) === 1 ? 9 : 2 }));

        let sanctionParams = null;
        let auditParams = null;
        let removed = null;
        on("moderation.createSanction", (params) => {
            sanctionParams = params;
            return { insertId: 3 };
        });
        on("moderation.appendAudit", (params) => {
            auditParams = params;
            return { insertId: 1 };
        });
        on("guilds.removeMember", (params) => {
            removed = params;
            return { affectedRows: 1 };
        });
        on("moderation.findSanction", () => ({ ...SANCTION_ROW, type: "kick", expiresAt: null }));
        on("notifications.create", () => ({ insertId: 8 }));
        on("notifications.findByIdForUser", () => null);

        const response = await request(createApp())
            .post(`/api/v1/guilds/${GUILD}/members/5/sanctions`)
            .set("Authorization", authorization)
            .send({ type: "kick", reason: "harcèlement d'un autre membre" });

        expect(response.status).toBe(201);
        expect(sanctionParams).toEqual([GUILD, 5, "kick", "harcèlement d'un autre membre", 1, null]);
        expect(auditParams[2]).toBe("member.kick");
        expect(auditParams[5]).toBe("harcèlement d'un autre membre");
        expect(removed).toEqual([GUILD, 5]);
        expect(response.body.sanction.reason).toBe("spam répété");
    });

    it("conserve l'appartenance pour un timeout et fixe une échéance", async () => {
        const actor = makeUser({ userId: 1, handle: "mod" });
        const authorization = allowModerator(actor);
        on("roles.highestPositionForMember", (params) => ({ position: Number(params[1]) === 1 ? 9 : 2 }));

        let sanctionParams = null;
        let removed = false;
        on("moderation.createSanction", (params) => {
            sanctionParams = params;
            return { insertId: 3 };
        });
        on("moderation.appendAudit", () => ({ insertId: 1 }));
        on("guilds.removeMember", () => {
            removed = true;
            return { affectedRows: 1 };
        });
        on("moderation.findSanction", () => SANCTION_ROW);
        on("notifications.create", () => ({ insertId: 8 }));
        on("notifications.findByIdForUser", () => null);

        const response = await request(createApp())
            .post(`/api/v1/guilds/${GUILD}/members/5/sanctions`)
            .set("Authorization", authorization)
            .send({ type: "timeout", reason: "spam répété", durationMinutes: 60 });

        expect(response.status).toBe(201);
        expect(removed).toBe(false);
        expect(sanctionParams[5]).toBeInstanceOf(Date);
        expect(new Date(response.body.sanction.appealDeadline).getTime()).toBeGreaterThan(Date.now());
    });

    it("exige un motif pour lever une sanction", async () => {
        const actor = makeUser({ userId: 1, handle: "mod" });
        const authorization = allowModerator(actor);

        const response = await request(createApp())
            .delete(`/api/v1/guilds/${GUILD}/sanctions/3`)
            .set("Authorization", authorization)
            .send({ reason: "" });

        expect(response.status).toBe(400);
    });

    it("n'accepte une contestation que du membre visé, une seule fois et dans le délai", async () => {
        const target = makeUser({ userId: 5, handle: "membre" });
        const other = makeUser({ userId: 6, handle: "curieux" });
        on("guilds.findById", () => ({ guildId: GUILD, ownerId: 99, name: "Atelier" }));
        on("moderation.findSanction", () => ({ ...SANCTION_ROW, issuedAt: new Date() }));

        const foreign = await request(createApp())
            .post(`/api/v1/guilds/${GUILD}/sanctions/3/appeal`)
            .set("Authorization", authenticateAs(other)(other))
            .send({ text: "ce n'est pas moi" });
        expect(foreign.status).toBe(404);

        on("moderation.recordAppeal", () => ({ affectedRows: 1 }));
        on("moderation.appendAudit", () => ({ insertId: 2 }));
        const accepted = await request(createApp())
            .post(`/api/v1/guilds/${GUILD}/sanctions/3/appeal`)
            .set("Authorization", authenticateAs(target)(target))
            .send({ text: "je conteste, le message était cité hors contexte" });
        expect(accepted.status).toBe(200);

        on("moderation.findSanction", () => ({
            ...SANCTION_ROW,
            issuedAt: new Date(Date.now() - 20 * 86_400_000),
        }));
        const late = await request(createApp())
            .post(`/api/v1/guilds/${GUILD}/sanctions/3/appeal`)
            .set("Authorization", authenticateAs(target)(target))
            .send({ text: "trop tard" });
        expect(late.status).toBe(400);
        expect(late.body.error.message).toMatch(/14 jours/);
    });

    it("sert le journal d'audit le plus récent en premier", async () => {
        const actor = makeUser({ userId: 1, handle: "mod" });
        const authorization = allowModerator(actor);
        on("moderation.listAudit", (params) => {
            expect(params).toEqual([GUILD, 50]);
            return [
                { entryId: 2, actorId: 1, action: "member.kick", targetType: "user", targetId: "5", reason: "spam", createdAt: new Date(), actorHandle: "mod", actorDisplayName: "Mod", actorAvatar: null },
                { entryId: 1, actorId: 1, action: "member.note", targetType: "user", targetId: "5", reason: null, createdAt: new Date(), actorHandle: "mod", actorDisplayName: "Mod", actorAvatar: null },
            ];
        });

        const response = await request(createApp())
            .get(`/api/v1/guilds/${GUILD}/audit`)
            .set("Authorization", authorization);

        expect(response.status).toBe(200);
        expect(response.body.entries.map((entry) => entry.action)).toEqual(["member.kick", "member.note"]);
        expect(response.body.entries[0].actor.handle).toBe("mod");
    });

    it("journalise l'ajout d'une note sans exposer son contenu", async () => {
        const actor = makeUser({ userId: 1, handle: "mod" });
        const authorization = allowModerator(actor);
        let auditParams = null;
        on("moderation.createNote", () => ({ insertId: 4 }));
        on("moderation.appendAudit", (params) => {
            auditParams = params;
            return { insertId: 3 };
        });
        on("moderation.listSanctionsForMember", () => []);
        on("moderation.listNotes", () => []);

        const response = await request(createApp())
            .post(`/api/v1/guilds/${GUILD}/members/5/notes`)
            .set("Authorization", authorization)
            .send({ body: "signalé trois fois par des membres différents" });

        expect(response.status).toBe(201);
        expect(auditParams[2]).toBe("member.note");
        expect(auditParams[5]).toBeNull();
    });
});
