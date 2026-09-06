"use strict";

const request = require("supertest");

const createApp = require("../../src/app");
const { on } = require("../helpers/db");
const { makeUser, authenticateAs } = require("../helpers/auth");
const accessTokenService = require("../../src/services/accessTokenService");

const ada = makeUser({ userId: 5, handle: "ada" });

function sessionFor(user = ada) {
    return authenticateAs(ada)(user);
}

describe("Jetons d'accès personnels", () => {
    it("émet un jeton une seule fois et n'en stocke que l'empreinte", async () => {
        const authorization = sessionFor();
        let created = null;
        on("accessTokens.countActive", () => ({ total: 0 }));
        on("accessTokens.create", (params) => {
            created = params;
            return { insertId: 11 };
        });
        on("accessTokens.findById", () => ({
            tokenId: 11, userId: 5, label: "portable", prefix: created?.[2], createdAt: new Date(), lastUsedAt: null, expiresAt: null, revokedAt: null,
        }));

        const response = await request(createApp())
            .post("/api/v1/account/tokens")
            .set("Authorization", authorization)
            .send({ label: "portable" });

        expect(response.status).toBe(201);
        expect(response.body.token).toMatch(/^qwp_[A-Za-z0-9_-]{40}$/);
        expect(response.body.item.tokenId).toBe(11);
        expect(response.body.item.prefix).toBe(response.body.token.slice(0, 12));
        expect(created[3]).toMatch(/^[0-9a-f]{64}$/);
        expect(created[3]).not.toContain(response.body.token);
        expect(JSON.stringify(response.body.item)).not.toContain(created[3]);
    });

    it("refuse d'aller au-delà du plafond de jetons actifs", async () => {
        const authorization = sessionFor();
        on("accessTokens.countActive", () => ({ total: accessTokenService.MAX_ACTIVE }));

        const response = await request(createApp())
            .post("/api/v1/account/tokens")
            .set("Authorization", authorization)
            .send({ label: "de trop" });

        expect(response.status).toBe(400);
    });

    it("authentifie une requête portée par un jeton valide", async () => {
        on("users.findById", () => [ada]);
        on("accessTokens.findByHash", () => ({
            tokenId: 11, userId: 5, label: "portable", prefix: "qwp_abcdefgh", createdAt: new Date(), lastUsedAt: null, expiresAt: null, revokedAt: null,
        }));
        on("accessTokens.touch", () => ({ affectedRows: 1 }));

        const response = await request(createApp())
            .get("/api/v1/auth/me")
            .set("Authorization", "Bearer qwp_abcdefghijklmnopqrstuvwxyz0123456789ABCD");

        expect(response.status).toBe(200);
        expect(response.body.user.handle).toBe("ada");
    });

    it("refuse un jeton révoqué, expiré ou inconnu", async () => {
        on("users.findById", () => [ada]);
        const app = createApp();
        const bearer = "Bearer qwp_abcdefghijklmnopqrstuvwxyz0123456789ABCD";

        on("accessTokens.findByHash", () => ({ tokenId: 11, userId: 5, revokedAt: new Date(), expiresAt: null }));
        expect((await request(app).get("/api/v1/auth/me").set("Authorization", bearer)).status).toBe(401);

        on("accessTokens.findByHash", () => ({ tokenId: 11, userId: 5, revokedAt: null, expiresAt: new Date(Date.now() - 1000) }));
        expect((await request(app).get("/api/v1/auth/me").set("Authorization", bearer)).status).toBe(401);

        on("accessTokens.findByHash", () => null);
        expect((await request(app).get("/api/v1/auth/me").set("Authorization", bearer)).status).toBe(401);
    });

    it("n'autorise pas un jeton à gérer les jetons", async () => {
        on("users.findById", () => [ada]);
        on("accessTokens.findByHash", () => ({ tokenId: 11, userId: 5, revokedAt: null, expiresAt: null, lastUsedAt: new Date() }));

        const response = await request(createApp())
            .get("/api/v1/account/tokens")
            .set("Authorization", "Bearer qwp_abcdefghijklmnopqrstuvwxyz0123456789ABCD");

        expect(response.status).toBe(403);
    });

    it("liste et révoque les jetons de la personne connectée", async () => {
        const authorization = sessionFor();
        on("accessTokens.listByUser", () => [
            { tokenId: 11, userId: 5, label: "portable", prefix: "qwp_abcdefgh", createdAt: new Date(), lastUsedAt: null, expiresAt: null, revokedAt: null },
        ]);
        let revoked = null;
        on("accessTokens.revoke", (params) => {
            revoked = params;
            return { affectedRows: 1 };
        });

        const list = await request(createApp()).get("/api/v1/account/tokens").set("Authorization", authorization);
        expect(list.status).toBe(200);
        expect(list.body.tokens).toHaveLength(1);
        expect(list.body.tokens[0]).not.toHaveProperty("tokenHash");

        const removal = await request(createApp()).delete("/api/v1/account/tokens/11").set("Authorization", authorization);
        expect(removal.status).toBe(204);
        expect(revoked).toEqual([11, 5]);

        on("accessTokens.revoke", () => ({ affectedRows: 0 }));
        const missing = await request(createApp()).delete("/api/v1/account/tokens/12").set("Authorization", authorization);
        expect(missing.status).toBe(404);
    });
});
