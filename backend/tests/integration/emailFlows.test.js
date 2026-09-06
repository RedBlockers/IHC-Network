"use strict";

const crypto = require("node:crypto");
const request = require("supertest");

const createApp = require("../../src/app");
const { on } = require("../helpers/db");
const { makeUser, authenticateAs } = require("../helpers/auth");
const mailService = require("../../src/services/mailService");

afterEach(() => jest.restoreAllMocks());

const TOKEN = "a".repeat(43);
const HASH = crypto.createHash("sha256").update(TOKEN).digest("hex");

const ACCOUNT = (overrides = {}) => ({
    userId: 1,
    handle: "alice",
    displayName: "Alice",
    email: "alice@example.org",
    isEmailVerified: 0,
    statusPreference: "online",
    ...overrides,
});

function quiet() {
    on("emailTokens.countRecent", () => ({ total: 0 }));
    on("emailTokens.invalidatePending", () => ({ affectedRows: 0 }));
    on("emailTokens.create", () => ({ insertId: 1 }));
}

describe("Vérification d'adresse et mot de passe oublié", () => {
    it("émet un lien de vérification et invalide le précédent", async () => {
        const user = makeUser(ACCOUNT());
        quiet();
        let invalidated = null;
        let created = null;
        on("emailTokens.invalidatePending", (params) => {
            invalidated = params;
            return { affectedRows: 1 };
        });
        on("emailTokens.create", (params) => {
            created = params;
            return { insertId: 2 };
        });

        const response = await request(createApp())
            .post("/api/v1/auth/verify/send")
            .set("Authorization", authenticateAs(user)(user))
            .set("Origin", "http://localhost:5173");

        expect(response.status).toBe(200);
        expect(invalidated).toEqual([1, "verify"]);
        expect(created[2]).toMatch(/^[0-9a-f]{64}$/);
    });

    it("plafonne le nombre de demandes par heure", async () => {
        const user = makeUser(ACCOUNT());
        on("emailTokens.countRecent", () => ({ total: 5 }));

        const response = await request(createApp())
            .post("/api/v1/auth/verify/send")
            .set("Authorization", authenticateAs(user)(user))
            .set("Origin", "http://localhost:5173");

        expect(response.status).toBe(429);
    });

    it("refuse un jeton expiré, déjà utilisé ou inconnu, avec le même message", async () => {
        const cases = [
            null,
            {
                tokenId: 1,
                userId: 1,
                purpose: "verify",
                email: "alice@example.org",
                expiresAt: new Date(Date.now() + 3_600_000),
                usedAt: new Date(),
            },
            {
                tokenId: 1,
                userId: 1,
                purpose: "verify",
                email: "alice@example.org",
                expiresAt: new Date(Date.now() - 1000),
                usedAt: null,
            },
        ];

        for (const row of cases) {
            on("emailTokens.findByHash", () => row);
            const response = await request(createApp())
                .post("/api/v1/auth/verify")
                .set("Origin", "http://localhost:5173")
                .send({ token: TOKEN });

            expect(response.status).toBe(400);
            expect(response.body.error.message).toBe("Ce lien n'est plus valable.");
        }
    });

    it("refuse un jeton émis pour une adresse qui a changé depuis", async () => {
        on("emailTokens.findByHash", () => ({
            tokenId: 1,
            userId: 1,
            purpose: "verify",
            email: "ancienne@example.org",
            expiresAt: new Date(Date.now() + 3_600_000),
            usedAt: null,
        }));
        on("users.findById", () => ACCOUNT({ email: "nouvelle@example.org" }));

        const response = await request(createApp())
            .post("/api/v1/auth/verify")
            .set("Origin", "http://localhost:5173")
            .send({ token: TOKEN });

        expect(response.status).toBe(400);
    });

    it("marque l'adresse vérifiée et consomme le jeton", async () => {
        on("emailTokens.findByHash", (params) => {
            expect(params[0]).toBe(HASH);
            return {
                tokenId: 1,
                userId: 1,
                purpose: "verify",
                email: "alice@example.org",
                expiresAt: new Date(Date.now() + 3_600_000),
                usedAt: null,
            };
        });
        on("users.findById", () => ACCOUNT());
        let consumed = false;
        on("emailTokens.consume", () => {
            consumed = true;
            return { affectedRows: 1 };
        });
        let verified = null;
        on("users.markEmailVerified", (params) => {
            verified = params;
            return { affectedRows: 1 };
        });

        const response = await request(createApp())
            .post("/api/v1/auth/verify")
            .set("Origin", "http://localhost:5173")
            .send({ token: TOKEN });

        expect(response.status).toBe(200);
        expect(consumed).toBe(true);
        expect(verified).toEqual([1]);
    });

    it("répond pareil que l'adresse existe ou non, pour ne pas devenir un annuaire", async () => {
        jest.spyOn(mailService, "smtpConfigured").mockReturnValue(true);
        quiet();
        on("users.findByEmail", () => null);
        const unknown = await request(createApp())
            .post("/api/v1/auth/password/forgot")
            .set("Origin", "http://localhost:5173")
            .send({ email: "fantome@example.org" });

        on("users.findByEmail", () => ACCOUNT());
        const known = await request(createApp())
            .post("/api/v1/auth/password/forgot")
            .set("Origin", "http://localhost:5173")
            .send({ email: "alice@example.org" });

        expect(unknown.status).toBe(known.status);
        expect(unknown.body).toEqual(known.body);
        expect(unknown.status).toBe(202);
    });

    it("indique que la récupération est indisponible lorsque le courrier est désactivé", async () => {
        jest.spyOn(mailService, "smtpConfigured").mockReturnValue(false);
        const response = await request(createApp())
            .post("/api/v1/auth/password/forgot")
            .send({ email: "alice@example.org" });
        expect(response.status).toBe(503);
        expect(response.body.error.message).toContain("n’est pas activée");
    });

    it("réinitialise le mot de passe et ferme toutes les sessions", async () => {
        on("emailTokens.findByHash", () => ({
            tokenId: 2,
            userId: 1,
            purpose: "reset",
            email: "alice@example.org",
            expiresAt: new Date(Date.now() + 3_600_000),
            usedAt: null,
        }));
        on("users.findById", () => ACCOUNT());
        on("emailTokens.consume", () => ({ affectedRows: 1 }));
        on("users.updatePasswordHash", () => ({ affectedRows: 1 }));
        let revoked = null;
        on("sessions.revokeAllExceptFamily", (params) => {
            revoked = params;
            return { affectedRows: 3 };
        });

        const response = await request(createApp())
            .post("/api/v1/auth/password/reset")
            .set("Origin", "http://localhost:5173")
            .send({ token: TOKEN, newPassword: "un tout nouveau secret long" });

        expect(response.status).toBe(200);
        expect(revoked).toEqual([1, ""]);
        expect(response.body.revokedSessions).toBe(3);
    });

    it("refuse un mot de passe trop court", async () => {
        const response = await request(createApp())
            .post("/api/v1/auth/password/reset")
            .set("Origin", "http://localhost:5173")
            .send({ token: TOKEN, newPassword: "court" });

        expect(response.status).toBe(400);
    });
});
