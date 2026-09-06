"use strict";

const request = require("supertest");

const createApp = require("../../src/app");
const { on } = require("../helpers/db");
const { makeUser, authenticateAs } = require("../helpers/auth");
const passwordService = require("../../src/services/passwordService");
const sessionService = require("../../src/services/sessionService");

const PASSWORD = "correct horse battery staple";
const NEW_PASSWORD = "un tout autre secret bien long";

let hash;
beforeAll(async () => {
    hash = await passwordService.hash(PASSWORD);
});

function quietLockout() {
    on("loginAttempts.record", () => ({ affectedRows: 1 }));
    on("loginHistory.record", () => ({ affectedRows: 1 }));
    on("totp.find", () => null);
    on("loginHistory.hasSucceededOn", () => ({ seen: 1 }));
}

describe("Compte : connexion, mot de passe et appareils", () => {
    it("ouvre une session avec l'adresse e-mail comme avec le pseudo", async () => {
        quietLockout();
        let identifier = null;
        on("users.findByIdentifierWithSecret", (params) => {
            identifier = params;
            return { userId: 1, handle: "alice", email: "alice@example.org", password: hash, statusPreference: "online" };
        });
        on("sessions.create", () => ({ affectedRows: 1 }));

        const response = await request(createApp())
            .post("/api/v1/auth/login")
            .send({ handle: "alice@example.org", password: PASSWORD });

        expect(response.status).toBe(200);
        expect(identifier).toEqual(["alice@example.org", "alice@example.org"]);
    });

    it("renvoie le même refus pour un compte inconnu et pour un mot de passe faux", async () => {
        quietLockout();
        on("users.findByIdentifierWithSecret", () => null);
        const unknown = await request(createApp())
            .post("/api/v1/auth/login")
            .send({ handle: "fantome", password: PASSWORD });

        on("users.findByIdentifierWithSecret", () => ({ userId: 1, handle: "alice", password: hash }));
        const wrong = await request(createApp())
            .post("/api/v1/auth/login")
            .send({ handle: "alice", password: "ce n'est pas le bon mot de passe" });

        expect(unknown.status).toBe(wrong.status);
        expect(unknown.body.error.message).toBe(wrong.body.error.message);
        expect(unknown.body.error.message).toBe("Identifiant ou mot de passe incorrect.");
    });

    it("n'écrit aucun historique personnel pour un compte qui n'existe pas", async () => {
        on("loginAttempts.record", () => ({ affectedRows: 1 }));
        const written = [];
        on("loginHistory.record", (params) => {
            written.push(params);
            return { affectedRows: 1 };
        });
        on("users.findByIdentifierWithSecret", () => null);

        await request(createApp()).post("/api/v1/auth/login").send({ handle: "fantome", password: PASSWORD });

        expect(written).toEqual([]);
    });

    it("consigne l'échec dans l'historique quand le compte existe", async () => {
        on("loginAttempts.record", () => ({ affectedRows: 1 }));
        const written = [];
        on("loginHistory.record", (params) => {
            written.push(params);
            return { affectedRows: 1 };
        });
        on("users.findByIdentifierWithSecret", () => ({ userId: 1, handle: "alice", password: hash }));

        await request(createApp()).post("/api/v1/auth/login").send({ handle: "alice", password: "faux" });

        expect(written).toHaveLength(1);
        expect(written[0][1]).toBe("failure");
        expect(written[0][3]).toMatch(/^[0-9a-f]{64}$/);
    });

    it("refuse un changement de mot de passe sans le mot de passe actuel exact", async () => {
        const user = makeUser({ userId: 1, handle: "alice" });
        on("users.findByHandleWithSecret", () => ({ userId: 1, handle: "alice", password: hash }));

        const response = await request(createApp())
            .post("/api/v1/auth/password")
            .set("Authorization", authenticateAs(user)(user))
            .set("Origin", "http://localhost:5173")
            .send({ currentPassword: "pas le bon", newPassword: NEW_PASSWORD });

        expect(response.status).toBe(401);
    });

    it("change le mot de passe et ferme les autres sessions", async () => {
        const user = makeUser({ userId: 1, handle: "alice" });
        on("users.findByHandleWithSecret", () => ({ userId: 1, handle: "alice", password: hash }));
        on("users.updatePasswordHash", () => ({ affectedRows: 1 }));
        on("sessions.findByToken", () => ({ sessionId: "s-1", familyId: "f-1", userId: 1 }));

        let revoked = null;
        on("sessions.revokeAllExceptFamily", (params) => {
            revoked = params;
            return { affectedRows: 2 };
        });

        const token = "jeton-de-rafraichissement";
        const response = await request(createApp())
            .post("/api/v1/auth/password")
            .set("Authorization", authenticateAs(user)(user))
            .set("Origin", "http://localhost:5173")
            .set("Cookie", `${sessionService.REFRESH_COOKIE}=${token}`)
            .send({ currentPassword: PASSWORD, newPassword: NEW_PASSWORD });

        expect(response.status).toBe(200);
        expect(revoked).toEqual([1, "f-1"]);
        expect(response.body.revokedSessions).toBe(2);
    });

    it("liste les appareils et désigne celui qui interroge", async () => {
        const user = makeUser({ userId: 1, handle: "alice" });
        on("sessions.findByToken", () => ({ sessionId: "s-1", familyId: "f-1", userId: 1 }));
        on("sessions.listActiveForUser", () => [
            { sessionId: "s-1", deviceLabel: "Windows · Chrome", createdAt: new Date(), lastUsedAt: new Date(), expiresAt: new Date() },
            { sessionId: "s-2", deviceLabel: "Android · Firefox", createdAt: new Date(), lastUsedAt: null, expiresAt: new Date() },
        ]);

        const response = await request(createApp())
            .get("/api/v1/auth/devices")
            .set("Authorization", authenticateAs(user)(user))
            .set("Cookie", `${sessionService.REFRESH_COOKIE}=jeton`);

        expect(response.status).toBe(200);
        expect(response.body.devices.map((device) => device.current)).toEqual([true, false]);
        expect(response.body.devices[1].label).toBe("Android · Firefox");
    });

    it("révoque la famille entière d'un appareil, pas seulement sa session courante", async () => {
        const user = makeUser({ userId: 1, handle: "alice" });
        on("sessions.findForUser", () => ({ sessionId: "s-2", familyId: "f-2", deviceLabel: "Android · Firefox" }));

        let family = null;
        on("sessions.revokeFamily", (params) => {
            family = params;
            return { affectedRows: 1 };
        });

        const response = await request(createApp())
            .delete("/api/v1/auth/devices/3f8f9d8e-1c2b-4a5d-8e7f-0a1b2c3d4e5f")
            .set("Authorization", authenticateAs(user)(user))
            .set("Origin", "http://localhost:5173");

        expect(response.status).toBe(204);
        expect(family).toEqual(["f-2"]);
    });

    it("refuse de révoquer un appareil qui n'appartient pas au compte", async () => {
        const user = makeUser({ userId: 1, handle: "alice" });
        on("sessions.findForUser", () => null);

        const response = await request(createApp())
            .delete("/api/v1/auth/devices/3f8f9d8e-1c2b-4a5d-8e7f-0a1b2c3d4e5f")
            .set("Authorization", authenticateAs(user)(user))
            .set("Origin", "http://localhost:5173");

        expect(response.status).toBe(404);
    });

    it("sert un historique de connexions lisible", async () => {
        const user = makeUser({ userId: 1, handle: "alice" });
        on("loginHistory.listForUser", (params) => {
            expect(params).toEqual([1, 30]);
            return [
                { entryId: 2, outcome: "success", deviceLabel: "Windows · Chrome", createdAt: new Date() },
                { entryId: 1, outcome: "failure", deviceLabel: "", createdAt: new Date() },
            ];
        });

        const response = await request(createApp())
            .get("/api/v1/auth/history")
            .set("Authorization", authenticateAs(user)(user));

        expect(response.status).toBe(200);
        expect(response.body.entries.map((entry) => entry.outcome)).toEqual(["success", "failure"]);
        expect(response.body.entries[1].label).toBe("Appareil inconnu");
    });

    it("dérive une étiquette d'appareil lisible sans conserver l'agent complet", () => {
        expect(sessionService.deviceLabel("Mozilla/5.0 (Windows NT 10.0) Chrome/120")).toBe("Windows · Chrome");
        expect(sessionService.deviceLabel("Mozilla/5.0 (Macintosh) Safari/605")).toBe("macOS · Safari");
        expect(sessionService.deviceLabel("")).toBe("Appareil inconnu · navigateur");
    });
});
