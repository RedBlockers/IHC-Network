"use strict";

const request = require("supertest");
const createApp = require("../../src/app");
const { on } = require("../helpers/db");
const { makeUser, authenticateAs } = require("../helpers/auth");

describe("Rôles personnalisés et permissions", () => {
    const owner = makeUser({ userId: 1, handle: "owner" });
    const member = makeUser({ userId: 2, handle: "member" });
    const app = createApp();

    beforeEach(() => {
        const token = authenticateAs(owner, member);
        app.locals.token = token;
        on("guilds.findById", () => ({ guildId: 7, ownerId: 1, name: "Atelier" }));
    });

    it("crée un rôle avec emoji, couleur et règles tri-état", async () => {
        on("access.guildPermission", (params) => {
            expect(params).toEqual([1, "MANAGE_ROLES", 7]);
            return [{ ownerId: 1, effect: null }];
        });
        on("roles.create", (params) => {
            expect(params.slice(0, 4)).toEqual([7, "Reviewers", "🔎", "#4C7DF0"]);
            return { insertId: 44, affectedRows: 1 };
        });
        on("roles.clearPermissions", () => ({ affectedRows: 0 }));
        on("roles.setPermission", (params) => {
            expect(params).toEqual([44, "MANAGE_MESSAGES", "allow"]);
            return { affectedRows: 1 };
        });
        on("roles.listByGuild", () => [{
            roleId: 44, guildId: 7, name: "Reviewers", iconEmoji: "🔎", color: "#4C7DF0",
            position: 12, isDefault: 0, isManaged: 0, mentionable: 1, memberCount: 0,
            permission: "MANAGE_MESSAGES", effect: "allow",
        }]);

        const response = await request(app)
            .post("/api/v1/guilds/7/roles")
            .set("Authorization", app.locals.token(owner))
            .send({
                name: "Reviewers",
                iconEmoji: "🔎",
                color: "#4C7DF0",
                position: 12,
                mentionable: true,
                permissions: { MANAGE_MESSAGES: "allow", SEND_MESSAGES: "inherit" },
            });

        expect(response.status).toBe(201);
        expect(response.body.role).toMatchObject({ roleId: 44, name: "Reviewers", iconEmoji: "🔎" });
        expect(response.body.role.permissions).toEqual({ MANAGE_MESSAGES: "allow" });
    });

    it("refuse la création sans permission effective", async () => {
        on("access.guildPermission", () => [{ ownerId: 1, effect: "deny" }]);
        const response = await request(app)
            .post("/api/v1/guilds/7/roles")
            .set("Authorization", app.locals.token(member))
            .send({ name: "Intrus", color: "#8895A5" });
        expect(response.status).toBe(403);
    });

    it("refuse une permission inconnue au niveau de l'API", async () => {
        on("access.guildPermission", () => [{ ownerId: 1, effect: null }]);
        const response = await request(app)
            .post("/api/v1/guilds/7/roles")
            .set("Authorization", app.locals.token(owner))
            .send({ name: "Invalide", permissions: { ROOT_ACCESS: "allow" } });
        expect(response.status).toBe(400);
    });
});
