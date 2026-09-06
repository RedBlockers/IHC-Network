"use strict";

const request = require("supertest");
const createApp = require("../../src/app");
const { on } = require("../helpers/db");
const { makeUser, authenticateAs } = require("../helpers/auth");

describe("Découverte de communautés", () => {
    const alice = makeUser({ userId: 1, handle: "alice" });
    const app = createApp();
    let token;

    beforeEach(() => {
        token = authenticateAs(alice);
        on("guilds.findById", () => [{ guildId: 4, name: "Laguna", ownerId: 1 }]);
        on("access.guildPermission", () => [{ ownerId: 1, effect: "allow" }]);
    });

    test("la liste ne contient que ce qui s'est déclaré", async () => {
        let sql = null;
        on("guilds.listDiscoverable", (_params, statement) => {
            sql = statement;
            return [];
        });

        await request(app).get("/api/v1/guilds/discover").expect(200);

        expect(sql).toContain("g.isDiscoverable = 1");
    });

    test("se lit sans compte", async () => {
        on("guilds.listDiscoverable", () => []);

        await request(app).get("/api/v1/guilds/discover").expect(200);
    });

    test("compte les membres à la lecture", async () => {
        let sql = null;
        on("guilds.listDiscoverable", (_params, statement) => {
            sql = statement;
            return [];
        });

        await request(app).get("/api/v1/guilds/discover").expect(200);

        expect(sql).toContain("SELECT COUNT(*) FROM guild_members");
    });

    test("la recherche voyage en paramètre lié", async () => {
        let captured = null;
        on("guilds.listDiscoverable", (params, sql) => {
            captured = { params, sql };
            return [];
        });

        await request(app).get("/api/v1/guilds/discover?q=jeux%20de%20r%C3%B4le").expect(200);

        expect(captured.sql).toContain("g.name LIKE ?");
        expect(captured.params[0]).toBe("%jeux de rôle%");
    });

    test("les étiquettes sont découpées et bornées", async () => {
        on("guilds.listDiscoverable", () => [
            {
                guildId: 4,
                name: "Laguna",
                icon: null,
                banner: "ocean",
                accent: null,
                discoveryPitch: "Une communauté de jeu",
                discoveryTags: "jeux, rôle, français, détente, soirées, autre, trop",
                members: 42,
            },
        ]);

        const response = await request(app).get("/api/v1/guilds/discover").expect(200);

        expect(response.body.guilds[0].members).toBe(42);
        expect(response.body.guilds[0].tags).toHaveLength(6);
    });

    describe("Réglage", () => {
        test("se retirer efface la présentation publique", async () => {
            let written = null;
            on("guilds.setDiscovery", (params) => {
                written = params;
                return { affectedRows: 1 };
            });

            await request(app)
                .put("/api/v1/guilds/4/discovery")
                .set("Authorization", token(alice))
                .send({ isDiscoverable: false, pitch: "un texte", tags: "jeux" })
                .expect(200);

            expect(written[0]).toBe(0);
            expect(written[1]).toBeNull();
            expect(written[2]).toBeNull();
        });

        test("refuse à qui ne gère pas la communauté", async () => {
            on("access.guildPermission", () => [{ ownerId: 99, effect: "deny" }]);

            await request(app)
                .put("/api/v1/guilds/4/discovery")
                .set("Authorization", token(alice))
                .send({ isDiscoverable: true })
                .expect(403);
        });
    });
});
