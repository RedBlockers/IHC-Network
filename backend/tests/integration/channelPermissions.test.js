"use strict";

const request = require("supertest");

const createApp = require("../../src/app");
const { on } = require("../helpers/db");
const { makeUser, authenticateAs } = require("../helpers/auth");

describe("Permissions propres aux salons", () => {
    const owner = makeUser({ userId: 1, handle: "owner" });
    const member = makeUser({ userId: 2, handle: "member" });
    const app = createApp();

    beforeEach(() => {
        app.locals.token = authenticateAs(owner, member);
        on("guilds.findById", () => ({ guildId: 7, ownerId: 1, name: "Atelier" }));
    });

    it("refuse un salon masqué même si le rôle autorise les salons par défaut", async () => {
        on("access.resolveChannel", () => [{
            channelId: 20, type: "text", name: "confidentiel", guildId: 7, friendshipId: null,
        }]);
        on("access.channelPermission", (params) => {
            expect(params).toEqual([2, "VIEW_CHANNEL", 20]);
            return [{ ownerId: 1, baseEffect: "allow", targetType: "member", overrideEffect: "deny" }];
        });

        const response = await request(app)
            .get("/api/v1/channels/20/messages")
            .set("Authorization", app.locals.token(member));

        expect(response.status).toBe(404);
    });

    it("refuse l'écriture quand le salon remplace SEND_MESSAGES par deny", async () => {
        on("access.resolveChannel", () => [{
            channelId: 20, type: "text", name: "lecture-seule", guildId: 7, friendshipId: null,
        }]);
        on("access.channelPermission", (params) => {
            const permission = params[1];
            return [{
                ownerId: 1,
                baseEffect: "allow",
                targetType: "member",
                overrideEffect: permission === "SEND_MESSAGES" ? "deny" : null,
            }];
        });

        const response = await request(app)
            .post("/api/v1/channels/20/messages")
            .set("Authorization", app.locals.token(member))
            .send({ content: "Je ne dois pas passer" });

        expect(response.status).toBe(403);
        expect(response.body.error.details.permission).toBe("SEND_MESSAGES");
    });

    it("enregistre uniquement les règles explicites d'un rôle du même serveur", async () => {
        on("access.guildPermission", () => [{ ownerId: 1, effect: null }]);
        on("channels.findById", () => ({ channelId: 20, guildId: 7, name: "review" }));
        on("roles.findById", () => ({ roleId: 44, guildId: 7, name: "Reviewers" }));
        on("channelPermissions.clearTarget", (params) => {
            expect(params).toEqual([20, "role", 44]);
            return { affectedRows: 1 };
        });
        const inserted = [];
        on("channelPermissions.set", (params) => {
            inserted.push(params);
            return { affectedRows: 1 };
        });
        on("channelPermissions.list", () => [
            { channelId: 20, targetType: "role", targetId: 44, permission: "VIEW_CHANNEL", effect: "allow", targetName: "Reviewers", targetIcon: "🔎", targetColor: "#4C7DF0" },
            { channelId: 20, targetType: "role", targetId: 44, permission: "SEND_MESSAGES", effect: "deny", targetName: "Reviewers", targetIcon: "🔎", targetColor: "#4C7DF0" },
        ]);

        const response = await request(app)
            .put("/api/v1/guilds/7/channels/20/permissions/role/44")
            .set("Authorization", app.locals.token(owner))
            .send({ permissions: { VIEW_CHANNEL: "allow", SEND_MESSAGES: "deny", ADD_REACTIONS: "inherit" } });

        expect(response.status).toBe(200);
        expect(inserted).toEqual([
            [20, "role", 44, "VIEW_CHANNEL", "allow"],
            [20, "role", 44, "SEND_MESSAGES", "deny"],
        ]);
        expect(response.body.overrides[0].permissions).toEqual({ VIEW_CHANNEL: "allow", SEND_MESSAGES: "deny" });
    });

    it("refuse une cible de rôle appartenant à un autre serveur", async () => {
        on("access.guildPermission", () => [{ ownerId: 1, effect: null }]);
        on("channels.findById", () => ({ channelId: 20, guildId: 7, name: "review" }));
        on("roles.findById", () => null);

        const response = await request(app)
            .put("/api/v1/guilds/7/channels/20/permissions/role/999")
            .set("Authorization", app.locals.token(owner))
            .send({ permissions: { VIEW_CHANNEL: "allow" } });

        expect(response.status).toBe(404);
    });

    it("ne divulgue pas un salon masqué dans le détail du serveur", async () => {
        on("access.guildRole", () => ({ role: "member" }));
        on("guilds.findById", () => ({ guildId: 7, ownerId: 1, name: "Atelier", description: "", banner: "ocean" }));
        on("users.listByGuild", () => [{
            userId: 2, handle: "member", displayName: "Member", avatar: null,
            statusPreference: "online", role: "member", roles: "[]",
        }]);
        on("channels.listByGuild", () => [
            { channelId: 20, guildId: 7, type: "text", name: "général", description: "", position: 0 },
            { channelId: 21, guildId: 7, type: "text", name: "direction", description: "", position: 1 },
        ]);
        on("categories.listByGuild", () => [{ categoryId: 3, guildId: 7, name: "ATELIER", position: 1 }]);
        on("access.guildPermissions", () => [{ ownerId: 1, permission: "VIEW_CHANNEL", effect: "allow" }]);
        on("access.channelPermission", (params) => [{
            ownerId: 1,
            baseEffect: "allow",
            targetType: Number(params[2]) === 21 ? "member" : null,
            overrideEffect: Number(params[2]) === 21 ? "deny" : null,
        }]);

        const response = await request(app)
            .get("/api/v1/guilds/7")
            .set("Authorization", app.locals.token(member));

        expect(response.status).toBe(200);
        expect(response.body.guild.channels.map((channel) => channel.name)).toEqual(["général"]);
        expect(response.body.guild.categories).toEqual([{ categoryId: 3, guildId: 7, name: "ATELIER", position: 1 }]);
    });
});
