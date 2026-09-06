"use strict";

const request = require("supertest");
const createApp = require("../../src/app");
const { on } = require("../helpers/db");
const { makeUser, authenticateAs } = require("../helpers/auth");
const passwordService = require("../../src/services/passwordService");
const totp = require("../../src/domain/totp");

const SECRET = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
const currentCode = () => totp.codeAt(SECRET, Math.floor(Date.now() / 1000 / totp.STEP_SECONDS));
const currentStep = () => Math.floor(Date.now() / 1000 / totp.STEP_SECONDS);

describe("Double authentification", () => {
    const alice = makeUser({ userId: 1, handle: "alice" });
    const app = createApp();
    let token;

    beforeEach(() => {
        token = authenticateAs(alice);
    });

    const auth = (call) => call.set("Authorization", token(alice));

    describe("Activation", () => {
        test("ne remplace pas une protection déjà active par un secret non confirmé", async () => {
            on("totp.find", () => ({ userId: 1, secret: SECRET, confirmedAt: new Date(), lastStep: null }));
            on("totp.upsertSecret", () => ({ affectedRows: 1 }));

            await auth(request(app).post("/api/v1/auth/2fa/setup")).expect(400);
        });

        test("le secret n'est rendu qu'à sa création", async () => {
            on("totp.find", () => null);
            on("totp.upsertSecret", () => ({ affectedRows: 1 }));

            const response = await auth(request(app).post("/api/v1/auth/2fa/setup")).expect(200);

            expect(response.body.secret).toMatch(/^[A-Z2-7]+$/);
            expect(response.body.uri).toContain("otpauth://totp/");
        });

        test("un secret non confirmé ne protège pas encore le compte", async () => {
            on("totp.find", () => ({ userId: 1, secret: SECRET, confirmedAt: null, lastStep: null }));
            on("totp.countUnusedRecovery", () => ({ total: 0 }));

            const response = await auth(request(app).get("/api/v1/auth/2fa")).expect(200);

            expect(response.body.enabled).toBe(false);
            expect(response.body.pending).toBe(true);
        });

        test("la confirmation active la protection et rend les codes de secours", async () => {
            on("totp.find", () => ({ userId: 1, secret: SECRET, confirmedAt: null, lastStep: null }));
            on("totp.confirm", () => ({ affectedRows: 1 }));
            on("totp.clearRecovery", () => ({ affectedRows: 0 }));
            on("totp.insertRecovery", () => ({ affectedRows: 10 }));

            const response = await auth(request(app).post("/api/v1/auth/2fa/confirm"))
                .send({ code: currentCode() })
                .expect(200);

            expect(response.body.enabled).toBe(true);
            expect(response.body.recoveryCodes).toHaveLength(10);
            expect(response.body.recoveryCodes[0]).toMatch(/^[0-9A-F]{5}-[0-9A-F]{5}$/);
        });

        test("un code faux ne confirme rien", async () => {
            on("totp.find", () => ({ userId: 1, secret: SECRET, confirmedAt: null, lastStep: null }));
            on("totp.confirm", () => {
                throw new Error("rien ne doit être activé sur un code faux");
            });

            await auth(request(app).post("/api/v1/auth/2fa/confirm")).send({ code: "000000" }).expect(401);
        });
    });

    describe("Connexion", () => {
        const withAccount = async () => {
            const hash = await passwordService.hash("motdepasse-tres-long-1");
            on("users.findByIdentifierWithSecret", () => ({ userId: 1, handle: "alice", password: hash }));
            on("loginAttempts.record", () => ({ affectedRows: 1 }));
            on("loginHistory.record", () => ({ affectedRows: 1 }));
            on("loginHistory.hasSucceededOn", () => ({ seen: 1 }));
            on("sessions.create", () => ({ affectedRows: 1 }));
            on("users.findById", () => [{ userId: 1, handle: "alice", displayName: "Alice" }]);
        };

        const login = (body) =>
            request(app)
                .post("/api/v1/auth/login")
                .send({ handle: "alice", password: "motdepasse-tres-long-1", ...body });

        test("refuse le bon mot de passe sans second facteur", async () => {
            await withAccount();
            on("totp.find", () => ({ userId: 1, secret: SECRET, confirmedAt: new Date(), lastStep: null }));

            const response = await login({}).expect(401);

            expect(response.body.error.details.twoFactorRequired).toBe(true);
        });

        test("accepte un code valide", async () => {
            await withAccount();
            on("totp.find", () => ({ userId: 1, secret: SECRET, confirmedAt: new Date(), lastStep: null }));
            on("totp.recordStep", () => ({ affectedRows: 1 }));

            await login({ code: currentCode() }).expect(200);
        });

        test("refuse de rejouer un code déjà consommé", async () => {
            await withAccount();
            on("totp.find", () => ({ userId: 1, secret: SECRET, confirmedAt: new Date(), lastStep: currentStep() }));

            await login({ code: currentCode() }).expect(401);
        });

        test("refuse un code consommé par une connexion concurrente", async () => {
            await withAccount();
            on("totp.find", () => ({ userId: 1, secret: SECRET, confirmedAt: new Date(), lastStep: null }));
            on("totp.recordStep", () => ({ affectedRows: 0 }));

            await login({ code: currentCode() }).expect(401);
        });

        test("un code de récupération ouvre la session et se consomme", async () => {
            await withAccount();
            const hash = await passwordService.hash("ABCDE-12345");
            on("totp.find", () => ({ userId: 1, secret: SECRET, confirmedAt: new Date(), lastStep: null }));
            on("totp.listUnusedRecovery", () => [{ codeId: 3, codeHash: hash }]);

            let consumed = null;
            on("totp.consumeRecovery", (params) => {
                consumed = params.map(Number);
                return { affectedRows: 1 };
            });

            await login({ recoveryCode: "abcde-12345" }).expect(200);

            expect(consumed.slice(0, 2)).toEqual([3, 1]);
        });

        test("le même code de récupération ne sert pas deux fois", async () => {
            await withAccount();
            const hash = await passwordService.hash("ABCDE-12345");
            on("totp.find", () => ({ userId: 1, secret: SECRET, confirmedAt: new Date(), lastStep: null }));
            on("totp.listUnusedRecovery", () => [{ codeId: 3, codeHash: hash }]);
            on("totp.consumeRecovery", () => ({ affectedRows: 0 }));

            await login({ recoveryCode: "ABCDE-12345" }).expect(401);
        });

        test("un compte sans double authentification se connecte normalement", async () => {
            await withAccount();
            on("totp.find", () => null);

            await login({}).expect(200);
        });

        test("un échec de second facteur compte comme un échec de connexion", async () => {
            await withAccount();
            on("totp.find", () => ({ userId: 1, secret: SECRET, confirmedAt: new Date(), lastStep: null }));

            let recorded = false;
            on("loginAttempts.record", () => {
                recorded = true;
                return { affectedRows: 1 };
            });

            await login({ code: "000000" }).expect(401);

            expect(recorded).toBe(true);
        });
    });

    describe("Désactivation", () => {
        test("exige le mot de passe", async () => {
            const hash = await passwordService.hash("motdepasse-tres-long-1");
            on("users.findByHandleWithSecret", () => ({ userId: 1, handle: "alice", password: hash }));
            on("totp.disable", () => {
                throw new Error("rien ne doit être désactivé sans le mot de passe");
            });

            await auth(request(app).delete("/api/v1/auth/2fa")).send({ password: "faux" }).expect(401);
        });

        test("retire la protection et les codes de secours ensemble", async () => {
            const hash = await passwordService.hash("motdepasse-tres-long-1");
            on("users.findByHandleWithSecret", () => ({ userId: 1, handle: "alice", password: hash }));
            on("totp.disable", () => ({ affectedRows: 1 }));

            let cleared = false;
            on("totp.clearRecovery", () => {
                cleared = true;
                return { affectedRows: 10 };
            });

            const response = await auth(request(app).delete("/api/v1/auth/2fa"))
                .send({ password: "motdepasse-tres-long-1" })
                .expect(200);

            expect(response.body.enabled).toBe(false);
            expect(cleared).toBe(true);
        });
    });
});
