"use strict";

const request = require("supertest");

const createApp = require("../../src/app");
const { on } = require("../helpers/db");
const { makeUser, authenticateAs } = require("../helpers/auth");
const webauthnService = require("../../src/services/webauthnService");

describe("Clés de sécurité", () => {
    const ada = makeUser({ userId: 1, handle: "ada" });
    const app = createApp();
    let token;

    const credentialId = Buffer.from("clé-de-test-0001");
    const asBase64Url = credentialId.toString("base64url");

    beforeEach(() => {
        token = authenticateAs(ada)(ada);
        on("credentials.listForUser", () => []);
        on("webauthnChallenges.create", () => ({ affectedRows: 1 }));
        on("webauthnChallenges.purge", () => ({ affectedRows: 1 }));
    });

    const auth = (req) => req.set("Authorization", token);

    it("émet un défi propre à la personne connectée", async () => {
        let stored = null;
        on("webauthnChallenges.create", (params) => {
            stored = params;
            return { affectedRows: 1 };
        });

        const response = await auth(request(app).post("/api/v1/auth/security-keys/options"));

        expect(response.status).toBe(200);
        expect(response.body.options.challenge).toEqual(expect.any(String));
        expect(stored[1]).toBe(1);
        expect(stored[2]).toBe("register");
    });

    it("propose d'exclure les clés déjà inscrites", async () => {
        on("credentials.listForUser", () => [
            { credentialId, userId: 1, transports: "usb,nfc", label: "YubiKey", backedUp: 0, counter: 3, createdAt: new Date(), lastUsedAt: null },
        ]);

        const response = await auth(request(app).post("/api/v1/auth/security-keys/options"));

        expect(response.body.options.excludeCredentials).toEqual([
            expect.objectContaining({ id: asBase64Url }),
        ]);
    });

    it("refuse un défi émis pour quelqu'un d'autre", async () => {
        on("webauthnChallenges.find", () => ({
            challenge: "defi-de-quelqu-un-dautre",
            userId: 99,
            purpose: "register",
            expiresAt: new Date(Date.now() + 60_000),
        }));

        const response = await auth(
            request(app)
                .post("/api/v1/auth/security-keys")
                .send({ challenge: "defi-de-quelqu-un-dautre", label: "Ma clé", credential: { id: asBase64Url } })
        );

        expect(response.status).toBe(400);
    });

    it("refuse un défi expiré", async () => {
        on("webauthnChallenges.find", () => ({
            challenge: "defi-perime-mais-de-longueur-realiste-aaaa",
            userId: 1,
            purpose: "register",
            expiresAt: new Date(Date.now() - 1000),
        }));

        const response = await auth(
            request(app)
                .post("/api/v1/auth/security-keys")
                .send({ challenge: "defi-perime-mais-de-longueur-realiste-aaaa", label: "Ma clé", credential: { id: asBase64Url } })
        );

        expect(response.status).toBe(400);
    });

    it("efface le défi au moment où il est lu", async () => {
        let purged = null;
        on("webauthnChallenges.find", () => null);
        on("webauthnChallenges.purge", (params) => {
            purged = params;
            return { affectedRows: 1 };
        });

        await auth(
            request(app)
                .post("/api/v1/auth/security-keys")
                .send({ challenge: "defi-quelconque-de-longueur-realiste-bbbb", label: "Ma clé", credential: { id: asBase64Url } })
        );

        expect(purged).toEqual(["defi-quelconque-de-longueur-realiste-bbbb"]);
    });

    it("ne nomme aucun compte dans le défi de connexion", async () => {
        let stored = null;
        on("webauthnChallenges.create", (params) => {
            stored = params;
            return { affectedRows: 1 };
        });

        const response = await request(app).post("/api/v1/auth/security-keys/login/options");

        expect(response.status).toBe(200);
        expect(stored[1]).toBeNull();
        expect(response.body.options.allowCredentials ?? []).toEqual([]);
    });

    it("exige que la clé vérifie son porteur pour une connexion sans mot de passe", async () => {
        const response = await request(app).post("/api/v1/auth/security-keys/login/options");

        expect(response.body.options.userVerification).toBe("required");
    });

    it("répond la même chose pour une clé inconnue et pour une signature fausse", async () => {
        on("webauthnChallenges.find", () => ({
            challenge: "defi-de-connexion",
            userId: null,
            purpose: "login",
            expiresAt: new Date(Date.now() + 60_000),
        }));
        on("credentials.findById", () => null);

        const response = await request(app)
            .post("/api/v1/auth/security-keys/login")
            .send({ challenge: "defi-de-connexion", credential: { id: asBase64Url } });

        expect(response.status).toBe(401);
        expect(response.body.error.message).toBe("Cette clé n'est pas reconnue.");
    });

    it("refuse une clé rejouée, sans confondre avec un compteur resté à zéro", () => {
        const { counterRegressed } = webauthnService;

        expect(counterRegressed(4, 7)).toBe(true);
        expect(counterRegressed(7, 7)).toBe(true);
        expect(counterRegressed(8, 7)).toBe(false);
        expect(counterRegressed(0, 0)).toBe(false);
    });

    it("borne la révocation au propriétaire de la clé", async () => {
        let params = null;
        on("credentials.remove", (values) => {
            params = values;
            return { affectedRows: 1 };
        });

        const response = await auth(request(app).delete(`/api/v1/auth/security-keys/${asBase64Url}`));

        expect(response.status).toBe(200);
        expect(params[1]).toBe(1);
    });

    it("ne rend jamais la partie publique d'une clé", async () => {
        on("credentials.listForUser", () => [
            {
                credentialId,
                userId: 1,
                publicKey: Buffer.from("partie-publique"),
                counter: 3,
                transports: "usb",
                label: "YubiKey bleue",
                backedUp: 1,
                createdAt: new Date(),
                lastUsedAt: null,
            },
        ]);

        const response = await auth(request(app).get("/api/v1/auth/security-keys"));

        expect(response.status).toBe(200);
        expect(response.body.keys[0]).toMatchObject({ label: "YubiKey bleue", backedUp: true });
        expect(response.body.keys[0].publicKey).toBeUndefined();
    });

    it("plafonne le nombre de clés", async () => {
        on("credentials.listForUser", () =>
            Array.from({ length: webauthnService.MAX_KEYS }, (_unused, index) => ({
                credentialId: Buffer.from(`clé-${index}`),
                userId: 1,
                transports: "",
                label: `Clé ${index}`,
                backedUp: 0,
                counter: 0,
                createdAt: new Date(),
                lastUsedAt: null,
            }))
        );

        const response = await auth(request(app).post("/api/v1/auth/security-keys/options"));

        expect(response.status).toBe(409);
    });
});
