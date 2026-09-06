"use strict";

const request = require("supertest");
const createApp = require("../../src/app");
const { on } = require("../helpers/db");
const { makeUser, authenticateAs } = require("../helpers/auth");

describe("Modèles de rôles et plafond des permissions", () => {
    const alice = makeUser({ userId: 1, handle: "alice" });
    const app = createApp();
    let token;

    const guild = (ownerId = 99) => {
        on("guilds.findById", () => [{ guildId: 7, name: "Laguna", ownerId }]);
        on("access.guildPermission", () => [{ ownerId, effect: "allow" }]);
    };

    const holds = (...permissions) =>
        on("access.guildPermissions", () => [
            { ownerId: 99, permission: null, effect: null },
            ...permissions.map((permission) => ({ ownerId: 99, permission, effect: "allow" })),
        ]);

    beforeEach(() => {
        token = authenticateAs(alice);
        guild();
        on("roles.highestPositionForMember", () => [{ position: 10 }]);
    });

    describe("Catalogue", () => {
        test("annonce ce que chaque modèle donne et ce qu'il ne donne pas", async () => {
            holds("VIEW_CHANNEL", "SEND_MESSAGES");

            const response = await request(app)
                .get("/api/v1/guilds/7/roles/templates")
                .set("Authorization", token(alice))
                .expect(200);

            const guest = response.body.templates.find((template) => template.id === "guest");
            expect(guest.summary).toEqual(expect.any(String));
            expect(guest.excludes).toEqual(expect.any(String));
        });

        test("marque comme indisponible un modèle qui dépasse ce que la personne détient", async () => {
            holds("VIEW_CHANNEL", "SEND_MESSAGES", "READ_MESSAGE_HISTORY");

            const response = await request(app)
                .get("/api/v1/guilds/7/roles/templates")
                .set("Authorization", token(alice))
                .expect(200);

            const moderator = response.body.templates.find((template) => template.id === "moderator");
            expect(moderator.available).toBe(false);
            expect(moderator.missing).toContain("KICK_MEMBERS");

            const guest = response.body.templates.find((template) => template.id === "guest");
            expect(guest.missing).toEqual(["CONNECT"]);
        });

        test("tout est disponible pour le propriétaire", async () => {
            guild(1);

            const response = await request(app)
                .get("/api/v1/guilds/7/roles/templates")
                .set("Authorization", token(alice))
                .expect(200);

            expect(response.body.templates.every((template) => template.available)).toBe(true);
        });
    });

    describe("Plafond des permissions", () => {
        const expectRoleCreated = () => {
            on("roles.create", () => ({ insertId: 55, affectedRows: 1 }));
            on("roles.clearPermissions", () => ({ affectedRows: 1 }));
            on("roles.setPermission", () => ({ affectedRows: 1 }));

            on("roles.listByGuild", () => [
                { roleId: 55, guildId: 7, name: "Invité", color: "#6C7688", position: 9, isDefault: 0, isManaged: 0, mentionable: 0, permission: "VIEW_CHANNEL", effect: "allow" },
            ]);
        };

        test("refuse d'accorder une permission que la personne ne détient pas", async () => {
            holds("VIEW_CHANNEL", "SEND_MESSAGES", "MANAGE_ROLES");
            expectRoleCreated();

            const response = await request(app)
                .post("/api/v1/guilds/7/roles")
                .set("Authorization", token(alice))
                .send({ name: "Presque admin", color: "#123456", permissions: { BAN_MEMBERS: "allow" } })
                .expect(403);

            expect(response.body.error.details.permissions).toEqual(["BAN_MEMBERS"]);
        });

        test("laisse toujours refuser une permission, même sans la détenir", async () => {
            holds("VIEW_CHANNEL", "MANAGE_ROLES");
            expectRoleCreated();

            await request(app)
                .post("/api/v1/guilds/7/roles")
                .set("Authorization", token(alice))
                .send({ name: "Silencieux", color: "#123456", permissions: { BAN_MEMBERS: "deny" } })
                .expect(201);
        });

        test("le propriétaire n'est borné par rien", async () => {
            guild(1);
            expectRoleCreated();

            await request(app)
                .post("/api/v1/guilds/7/roles")
                .set("Authorization", token(alice))
                .send({ name: "Second", color: "#123456", permissions: { BAN_MEMBERS: "allow" } })
                .expect(201);
        });

        test("la même borne s'applique à la modification d'un rôle existant", async () => {
            holds("VIEW_CHANNEL", "MANAGE_ROLES");
            on("roles.findById", () => [{ roleId: 55, guildId: 7, name: "Invité", position: 5, isDefault: 0, isManaged: 0 }]);

            await request(app)
                .patch("/api/v1/guilds/7/roles/55")
                .set("Authorization", token(alice))
                .send({ permissions: { BAN_MEMBERS: "allow" } })
                .expect(403);
        });
    });

    describe("Application d'un modèle", () => {
        test("crée le rôle avec les permissions du modèle", async () => {
            guild(1);
            let written = null;
            on("roles.create", () => ({ insertId: 55, affectedRows: 1 }));
            on("roles.clearPermissions", () => ({ affectedRows: 0 }));
            on("roles.setPermission", (params) => {
                written = [...(written ?? []), ...params];
                return { affectedRows: 1 };
            });
            on("roles.listByGuild", () => [
                { roleId: 55, guildId: 7, name: "Modération", color: "#4C8DFF", position: 9, isDefault: 0, isManaged: 0, mentionable: 0, permission: "KICK_MEMBERS", effect: "allow" },
            ]);

            const response = await request(app)
                .post("/api/v1/guilds/7/roles/templates/moderator")
                .set("Authorization", token(alice))
                .send({})
                .expect(201);

            expect(response.body.role.name).toBe("Modération");
            expect(JSON.stringify(written)).toContain("KICK_MEMBERS");
        });

        test("accepte un nom propre à la communauté", async () => {
            guild(1);
            let created = null;
            on("roles.create", (params) => {
                created = params;
                return { insertId: 55, affectedRows: 1 };
            });
            on("roles.clearPermissions", () => ({ affectedRows: 0 }));
            on("roles.setPermission", () => ({ affectedRows: 1 }));
            on("roles.listByGuild", () => [
                { roleId: 55, guildId: 7, name: "Gardiens", color: "#4C8DFF", position: 9, isDefault: 0, isManaged: 0, mentionable: 0, permission: null, effect: null },
            ]);

            await request(app)
                .post("/api/v1/guilds/7/roles/templates/moderator")
                .set("Authorization", token(alice))
                .send({ name: "Gardiens" })
                .expect(201);

            expect(JSON.stringify(created)).toContain("Gardiens");
        });

        test("un modèle appliqué reste borné par ce que la personne détient", async () => {
            holds("VIEW_CHANNEL", "MANAGE_ROLES");

            await request(app)
                .post("/api/v1/guilds/7/roles/templates/moderator")
                .set("Authorization", token(alice))
                .send({})
                .expect(403);
        });

        test("refuse un modèle inventé", async () => {
            guild(1);

            await request(app)
                .post("/api/v1/guilds/7/roles/templates/superadmin")
                .set("Authorization", token(alice))
                .send({})
                .expect(400);
        });
    });
});
