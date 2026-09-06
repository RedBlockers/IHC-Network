"use strict";

const request = require("supertest");

const createApp = require("../../src/app");
const { on } = require("../helpers/db");
const { makeUser, authenticateAs } = require("../helpers/auth");

function allowOwner(owner, guildId = 7) {
    const token = authenticateAs(owner);
    on("guilds.findById", () => ({ guildId, ownerId: owner.userId, name: "Studio" }));
    on("access.guildPermission", () => [{ ownerId: owner.userId, effect: null }]);
    return token(owner);
}

describe("Catégories de salons", () => {
    it("crée une catégorie persistante pour un gestionnaire de salons", async () => {
        const owner = makeUser({ userId: 1, handle: "owner" });
        const authorization = allowOwner(owner);

        on("categories.nextPosition", () => ({ position: 3 }));
        on("categories.create", (params, sql) => {
            expect(sql).toContain("INSERT INTO channel_categories");
            expect(params).toEqual([7, "PROJETS", 3]);
            return { insertId: 41 };
        });
        on("categories.findById", () => ({ categoryId: 41, guildId: 7, name: "PROJETS", position: 3 }));

        const response = await request(createApp())
            .post("/api/v1/guilds/7/categories")
            .set("Authorization", authorization)
            .send({ name: "Projets" });

        expect(response.status).toBe(201);
        expect(response.body.category).toEqual({ categoryId: 41, guildId: 7, name: "PROJETS", position: 3 });
    });

    it("refuse d'associer un salon à une catégorie d'une autre communauté", async () => {
        const owner = makeUser({ userId: 1, handle: "owner" });
        const authorization = allowOwner(owner);
        on("categories.findById", () => ({ categoryId: 90, guildId: 8, name: "PRIVÉ", position: 1 }));

        const response = await request(createApp())
            .post("/api/v1/guilds/7/channels")
            .set("Authorization", authorization)
            .send({ type: "text", name: "roadmap", description: "", categoryId: 90 });

        expect(response.status).toBe(404);
        expect(response.body.error.message).toBe("Catégorie introuvable dans cette communauté.");
    });

    it("renomme et supprime uniquement une catégorie de la communauté courante", async () => {
        const owner = makeUser({ userId: 1, handle: "owner" });
        const authorization = allowOwner(owner);
        on("categories.findById", () => ({ categoryId: 41, guildId: 7, name: "PROJETS", position: 3 }));
        on("categories.update", (params) => {
            expect(params).toEqual(["ARCHIVES", 4, 41, 7]);
            return { affectedRows: 1 };
        });
        on("categories.delete", (params) => {
            expect(params).toEqual([41, 7]);
            return { affectedRows: 1 };
        });

        const renamed = await request(createApp())
            .patch("/api/v1/guilds/7/categories/41")
            .set("Authorization", authorization)
            .send({ name: "Archives", position: 4 });
        expect(renamed.status).toBe(200);
        expect(renamed.body.category).toEqual({ categoryId: 41, guildId: 7, name: "ARCHIVES", position: 4 });

        const removed = await request(createApp())
            .delete("/api/v1/guilds/7/categories/41")
            .set("Authorization", authorization);
        expect(removed.status).toBe(204);
    });
});
