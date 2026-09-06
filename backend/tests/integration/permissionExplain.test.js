"use strict";

const request = require("supertest");

const createApp = require("../../src/app");
const { on } = require("../helpers/db");
const { makeUser, authenticateAs } = require("../helpers/auth");
const accessService = require("../../src/services/accessService");

const GUILD = 7;
const admin = makeUser({ userId: 1, handle: "admin" });

function asAdmin() {
    on("guilds.findById", () => ({ guildId: GUILD, ownerId: 99, name: "Atelier" }));
    on("access.guildPermission", () => [{ ownerId: 99, effect: "allow" }]);
    on("access.guildRole", () => ({ role: "admin" }));
    on("access.resolveChannel", () => ({ channelId: 10, guildId: GUILD, type: "text", name: "général", position: 0 }));
    return authenticateAs(admin)(admin);
}

const CHANNEL = { channelId: 10, guildId: GUILD, type: "text", name: "général", position: 0 };

describe("Explication des décisions de permission", () => {
    it("nomme le refus le plus précis d'abord", async () => {
        on("access.channelPermission", () => [
            { ownerId: 99, baseEffect: "allow", targetType: "member", overrideEffect: "deny" },
            { ownerId: 99, baseEffect: "allow", targetType: "role", overrideEffect: "allow" },
        ]);

        const verdict = await accessService.explainChannelPermission(5, 10, "SEND_MESSAGES", CHANNEL);
        expect(verdict.allowed).toBe(false);
        expect(verdict.source).toBe("member-deny");
        expect(verdict.reason).toMatch(/sur cette personne/);
    });

    it("passe au rôle quand rien ne vise la personne", async () => {
        on("access.channelPermission", () => [
            { ownerId: 99, baseEffect: "allow", targetType: "role", overrideEffect: "deny" },
        ]);

        const verdict = await accessService.explainChannelPermission(5, 10, "SEND_MESSAGES", CHANNEL);
        expect(verdict.source).toBe("role-deny");
        expect(verdict.allowed).toBe(false);
    });

    it("retombe sur la permission de rôle, puis sur le refus par défaut", async () => {
        on("access.channelPermission", () => [{ ownerId: 99, baseEffect: "allow", targetType: null, overrideEffect: null }]);
        const granted = await accessService.explainChannelPermission(5, 10, "SEND_MESSAGES", CHANNEL);
        expect(granted).toMatchObject({ allowed: true, source: "base-allow" });

        on("access.channelPermission", () => [{ ownerId: 99, baseEffect: null, targetType: null, overrideEffect: null }]);
        const refused = await accessService.explainChannelPermission(5, 10, "SEND_MESSAGES", CHANNEL);
        expect(refused).toMatchObject({ allowed: false, source: "default" });
        expect(refused.reason).toMatch(/refus par défaut/);
    });

    it("le propriétaire est expliqué comme tel, sans détour", async () => {
        on("access.channelPermission", () => [{ ownerId: 5, baseEffect: null, targetType: null, overrideEffect: null }]);
        const verdict = await accessService.explainChannelPermission(5, 10, "SEND_MESSAGES", CHANNEL);
        expect(verdict).toMatchObject({ allowed: true, source: "owner" });
    });

    it("la décision et son explication ne peuvent pas diverger", async () => {
        const cases = [
            [{ ownerId: 99, baseEffect: "allow", targetType: "member", overrideEffect: "deny" }],
            [{ ownerId: 99, baseEffect: "deny", targetType: "role", overrideEffect: "allow" }],
            [{ ownerId: 99, baseEffect: "allow", targetType: null, overrideEffect: null }],
            [{ ownerId: 99, baseEffect: null, targetType: null, overrideEffect: null }],
        ];

        for (const rows of cases) {
            on("access.channelPermission", () => rows);
            const decided = await accessService.hasChannelPermission(5, 10, "SEND_MESSAGES", CHANNEL);
            const explained = await accessService.explainChannelPermission(5, 10, "SEND_MESSAGES", CHANNEL);
            expect(explained.allowed).toBe(decided);
        }
    });

    it("sert « voir comme » à l'administration", async () => {
        const authorization = asAdmin();
        on("access.channelPermission", () => [{ ownerId: 99, baseEffect: "allow", targetType: null, overrideEffect: null }]);

        const response = await request(createApp())
            .get(`/api/v1/guilds/${GUILD}/channels/10/permissions/explain?userId=5&permissions=SEND_MESSAGES,ATTACH_FILES`)
            .set("Authorization", authorization);

        expect(response.status).toBe(200);
        expect(response.body.permissions.map((p) => p.permission)).toEqual(["SEND_MESSAGES", "ATTACH_FILES"]);
        expect(response.body.permissions[0].reason).toBeTruthy();
    });
});

describe("Réorganisation des rôles", () => {
    it("refuse de hisser un rôle au niveau de celui qui réordonne", async () => {
        const authorization = asAdmin();
        on("roles.listByGuild", () => [
            { roleId: 11, guildId: GUILD, name: "A", position: 3, isDefault: 0, isManaged: 0, mentionable: 0, color: "#fff", iconEmoji: null },
            { roleId: 12, guildId: GUILD, name: "B", position: 2, isDefault: 0, isManaged: 0, mentionable: 0, color: "#fff", iconEmoji: null },
        ]);
        on("roles.highestPositionForMember", () => ({ position: 1 }));

        const response = await request(createApp())
            .patch(`/api/v1/guilds/${GUILD}/roles/order`)
            .set("Authorization", authorization)
            .send({ order: [11, 12] });

        expect(response.status).toBe(400);
        expect(response.body.error.message).toMatch(/sous le vôtre/);
    });

    it("refuse un rôle cité deux fois", async () => {
        const authorization = asAdmin();
        on("roles.listByGuild", () => [
            { roleId: 11, guildId: GUILD, name: "A", position: 3, isDefault: 0, isManaged: 0, mentionable: 0, color: "#fff", iconEmoji: null },
        ]);

        const response = await request(createApp())
            .patch(`/api/v1/guilds/${GUILD}/roles/order`)
            .set("Authorization", authorization)
            .send({ order: [11, 11] });

        expect(response.status).toBe(400);
    });

    it("place le premier de la liste au rang le plus haut permis", async () => {
        const authorization = asAdmin();
        on("roles.listByGuild", () => [
            { roleId: 11, guildId: GUILD, name: "A", position: 3, isDefault: 0, isManaged: 0, mentionable: 0, color: "#fff", iconEmoji: null },
            { roleId: 12, guildId: GUILD, name: "B", position: 2, isDefault: 0, isManaged: 0, mentionable: 0, color: "#fff", iconEmoji: null },
        ]);
        on("roles.highestPositionForMember", () => ({ position: 9 }));

        const placed = [];
        on("roles.setPosition", (params) => {
            placed.push(params);
            return { affectedRows: 1 };
        });

        const response = await request(createApp())
            .patch(`/api/v1/guilds/${GUILD}/roles/order`)
            .set("Authorization", authorization)
            .send({ order: [12, 11] });

        expect(response.status).toBe(200);
        expect(placed).toEqual([[8, GUILD, 12], [7, GUILD, 11]]);
    });
});
