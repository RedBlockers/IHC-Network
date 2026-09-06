"use strict";

const request = require("supertest");
const createApp = require("../../src/app");
const { on } = require("../helpers/db");
const { allowWrite } = require("../helpers/writePath");
const { makeUser, authenticateAs } = require("../helpers/auth");

describe("Mentions de rôle", () => {
    const alice = makeUser({ userId: 1, handle: "alice" });
    const app = createApp();
    let token;

    const roles = () => [
        { roleId: 20, guildId: 4, name: "Joueurs", color: "#123456", position: 5, isDefault: 0, isManaged: 0, mentionable: 1, permission: null, effect: null },
        { roleId: 21, guildId: 4, name: "Administration", color: "#654321", position: 9, isDefault: 0, isManaged: 0, mentionable: 0, permission: null, effect: null },
    ];

    const send = (content) =>
        request(app)
            .post("/api/v1/channels/10/messages")
            .set("Authorization", token(alice))
            .send({ content });

    beforeEach(() => {
        token = authenticateAs(alice);
        on("access.resolveChannel", () => [{ channelId: 10, type: "text", guildId: 4, friendshipId: null }]);
        on("access.channelPermission", () => [{ ownerId: 1, baseEffect: null, targetType: null, overrideEffect: null }]);
        allowWrite();
        on("roles.listByGuild", roles);
        on("messages.create", () => ({ affectedRows: 1 }));
        on("messages.findById", () => ({
            messageId: "7168291357943578624",
            channelId: 10,
            content: "peu importe",
            createdAt: new Date(),
            userId: 1,
            handle: "alice",
            displayName: "Alice",
            avatar: null,
        }));
        on("attachments.listForMessages", () => []);
        on("messages.resolveMentions", () => []);
        on("notifications.create", () => ({ insertId: 1, affectedRows: 1 }));
        on("notifications.findByIdForUser", () => null);
    });

    test("prévient les porteurs d'un rôle mentionnable", async () => {
        let asked = null;
        on("messages.listRoleMentionRecipients", (params) => {
            asked = params.map(Number);
            return [{ userId: 2 }, { userId: 3 }];
        });

        await send("Bonjour @&20, la partie commence").expect(201);

        expect(asked.slice(0, 1)).toEqual([20]);
    });

    test("refuse un rôle qui ne se laisse pas mentionner", async () => {
        on("access.channelPermission", (params) => [
            {
                ownerId: 99,
                baseEffect: params[1] === "MENTION_EVERYONE" ? "deny" : "allow",
                targetType: null,
                overrideEffect: null,
            },
        ]);

        const response = await send("Au secours @&21").expect(403);

        expect(response.body.error.details.roles).toEqual([21]);
    });

    test("MENTION_EVERYONE permet de joindre un rôle protégé", async () => {
        on("messages.listRoleMentionRecipients", () => [{ userId: 4 }]);

        await send("Au secours @&21").expect(201);
    });

    test("un rôle d'une autre communauté est ignoré, pas refusé", async () => {
        let called = false;
        on("messages.listRoleMentionRecipients", () => {
            called = true;
            return [];
        });

        await send("Coucou @&999").expect(201);

        expect(called).toBe(false);
    });

    test("les destinataires d'un rôle passent par la visibilité du salon", async () => {
        let sql = null;
        on("messages.listRoleMentionRecipients", (_params, statement) => {
            sql = statement;
            return [];
        });

        await send("@&20 réunion").expect(201);

        expect(sql).toContain("VIEW_CHANNEL");
        expect(sql).toContain("guild_member_roles mentioned");
    });

    test("l'auteur ne se notifie pas lui-même", async () => {
        let params = null;
        on("messages.listRoleMentionRecipients", (received) => {
            params = received;
            return [];
        });

        await send("@&20 coucou").expect(201);

        expect(Number(params.at(-1))).toBe(1);
    });

    test("un texte sans mention de rôle n'interroge rien", async () => {
        let called = false;
        on("messages.listRoleMentionRecipients", () => {
            called = true;
            return [];
        });

        await send("Une adresse : a@b.fr et un prix de 20&30").expect(201);

        expect(called).toBe(false);
    });
});
