"use strict";

const request = require("supertest");
const createApp = require("../../src/app");
const { on, isTransactionActive } = require("../helpers/db");
const { makeUser, authenticateAs } = require("../helpers/auth");

describe("Réorganisation des catégories et des salons", () => {
    const alice = makeUser({ userId: 1, handle: "alice" });
    const app = createApp();
    let token;

    beforeEach(() => {
        token = authenticateAs(alice);
        on("guilds.findById", () => [{ guildId: 7, name: "Laguna", ownerId: 1 }]);
        on("access.guildPermission", () => [{ ownerId: 1, effect: "allow" }]);
        on("categories.listByGuild", () => [
            { categoryId: 1, guildId: 7, name: "ACCUEIL", position: 0 },
            { categoryId: 2, guildId: 7, name: "JEUX", position: 1 },
            { categoryId: 3, guildId: 7, name: "ARCHIVES", position: 2 },
        ]);
        on("categories.findById", (params) => ({ categoryId: Number(params[0]), guildId: 7, name: "JEUX", position: 1 }));
        on("channels.listByGuild", () => [
            { channelId: 10, guildId: 7, categoryId: 1, name: "general", type: "text", position: 0 },
            { channelId: 11, guildId: 7, categoryId: 1, name: "annonces", type: "text", position: 1 },
            { channelId: 12, guildId: 7, categoryId: 2, name: "vocal", type: "voice", position: 0 },
        ]);
    });

    describe("Catégories", () => {
        test("écrit les positions dans l'ordre reçu, en une seule transaction", async () => {
            const written = [];
            on("categories.setPosition", (params) => {
                expect(isTransactionActive()).toBe(true);
                written.push([Number(params[1]), Number(params[0])]);
                return { affectedRows: 1 };
            });

            const response = await request(app)
                .patch("/api/v1/guilds/7/categories/order")
                .set("Authorization", token(alice))
                .send({ order: [3, 1, 2] })
                .expect(200);

            expect(written).toEqual([[3, 0], [1, 1], [2, 2]]);
            expect(response.body.categories).toHaveLength(3);
        });

        test("refuse un ordre qui ne cite pas tout le monde", async () => {
            const response = await request(app)
                .patch("/api/v1/guilds/7/categories/order")
                .set("Authorization", token(alice))
                .send({ order: [1, 2] })
                .expect(400);

            expect(response.body.error.message).toMatch(/une fois exactement/);
        });

        test("refuse un doublon", async () => {
            await request(app)
                .patch("/api/v1/guilds/7/categories/order")
                .set("Authorization", token(alice))
                .send({ order: [1, 1, 2] })
                .expect(400);
        });

        test("refuse une catégorie d'une autre communauté", async () => {
            await request(app)
                .patch("/api/v1/guilds/7/categories/order")
                .set("Authorization", token(alice))
                .send({ order: [1, 2, 99] })
                .expect(404);
        });

        test("refuse à qui ne gère pas les salons", async () => {
            on("access.guildPermission", () => [{ ownerId: 99, effect: "deny" }]);

            await request(app)
                .patch("/api/v1/guilds/7/categories/order")
                .set("Authorization", token(alice))
                .send({ order: [1, 2, 3] })
                .expect(403);
        });
    });

    describe("Salons", () => {
        test("range les salons et pose leur catégorie en une écriture", async () => {
            const written = [];
            on("channels.setPlacement", (params) => {
                expect(isTransactionActive()).toBe(true);
                written.push({ categoryId: params[0], position: params[1], channelId: Number(params[2]) });
                return { affectedRows: 1 };
            });

            await request(app)
                .patch("/api/v1/guilds/7/channels/order")
                .set("Authorization", token(alice))
                .send({ categoryId: 2, order: [11, 12] })
                .expect(200);

            expect(written).toEqual([
                { categoryId: 2, position: 0, channelId: 11 },
                { categoryId: 2, position: 1, channelId: 12 },
            ]);
        });

        test("accepte la zone sans catégorie", async () => {
            const written = [];
            on("channels.setPlacement", (params) => {
                written.push(params[0]);
                return { affectedRows: 1 };
            });

            await request(app)
                .patch("/api/v1/guilds/7/channels/order")
                .set("Authorization", token(alice))
                .send({ categoryId: null, order: [10] })
                .expect(200);

            expect(written).toEqual([null]);
        });

        test("refuse un salon d'une autre communauté", async () => {
            on("channels.setPlacement", () => ({ affectedRows: 1 }));

            await request(app)
                .patch("/api/v1/guilds/7/channels/order")
                .set("Authorization", token(alice))
                .send({ categoryId: null, order: [10, 999] })
                .expect(404);
        });

        test("refuse une catégorie d'accueil qui n'existe pas", async () => {
            on("categories.findById", () => null);

            await request(app)
                .patch("/api/v1/guilds/7/channels/order")
                .set("Authorization", token(alice))
                .send({ categoryId: 42, order: [10] })
                .expect(404);
        });

        test("refuse un salon cité deux fois", async () => {
            await request(app)
                .patch("/api/v1/guilds/7/channels/order")
                .set("Authorization", token(alice))
                .send({ categoryId: null, order: [10, 10] })
                .expect(400);
        });
    });
});
