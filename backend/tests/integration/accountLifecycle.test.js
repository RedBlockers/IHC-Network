"use strict";

const request = require("supertest");
const createApp = require("../../src/app");
const { on } = require("../helpers/db");
const { makeUser, authenticateAs } = require("../helpers/auth");
const passwordService = require("../../src/services/passwordService");
const lifecycle = require("../../src/services/accountLifecycleService");

describe("Cycle de vie d'un compte", () => {
    const alice = makeUser({ userId: 1, handle: "alice", email: "alice@example.com" });
    const app = createApp();
    let token;

    beforeEach(() => {
        token = authenticateAs(alice);
    });

    const auth = (call) => call.set("Authorization", token(alice));

    describe("Suppression différée", () => {
        const withPassword = async () => {
            const hash = await passwordService.hash("motdepasse-tres-long-1");
            on("users.findByHandleWithSecret", () => ({ userId: 1, handle: "alice", password: hash }));
            on("guilds.countOwnedByUser", () => ({ total: 0 }));
        };

        test("programme la suppression et ferme les sessions", async () => {
            await withPassword();
            on("users.requestDeletion", () => ({ affectedRows: 1 }));

            let revoked = false;
            on("sessions.revokeAllExceptFamily", () => {
                revoked = true;
                return { affectedRows: 3 };
            });

            const response = await auth(request(app).post("/api/v1/account/deletion"))
                .send({ password: "motdepasse-tres-long-1" })
                .expect(202);

            expect(response.body.graceDays).toBe(30);
            expect(revoked).toBe(true);
        });

        test("exige le mot de passe", async () => {
            await withPassword();
            on("users.requestDeletion", () => {
                throw new Error("rien ne doit être programmé sans le mot de passe");
            });

            await auth(request(app).post("/api/v1/account/deletion")).send({ password: "faux" }).expect(401);
        });

        test("préserve les communautés dont le compte est propriétaire", async () => {
            await withPassword();
            on("guilds.countOwnedByUser", () => ({ total: 1 }));
            await auth(request(app).post("/api/v1/account/deletion"))
                .send({ password: "motdepasse-tres-long-1" })
                .expect(409);
        });

        test("refuse une seconde demande", async () => {
            await withPassword();
            on("users.requestDeletion", () => ({ affectedRows: 0 }));

            await auth(request(app).post("/api/v1/account/deletion"))
                .send({ password: "motdepasse-tres-long-1" })
                .expect(409);
        });

        test("annuler ne demande rien de plus que d'être connecté", async () => {
            on("users.cancelDeletion", () => ({ affectedRows: 1 }));

            const response = await auth(request(app).delete("/api/v1/account/deletion")).expect(200);

            expect(response.body.deletionRequestedAt).toBeNull();
        });
    });

    describe("Purge à l'échéance", () => {
        test("n'efface rien avant l'échéance", async () => {
            const purged = await lifecycle.purgeIfDue({ userId: 1, deletionRequestedAt: new Date() });
            expect(purged).toBe(false);
        });

        test("efface au premier accès après l'échéance", async () => {
            on("users.clearFriendships", () => ({ affectedRows: 1 }));
            let deleted = null;
            on("users.hardDelete", (params) => {
                deleted = Number(params[0]);
                return { affectedRows: 1 };
            });

            const past = new Date(Date.now() - 31 * 24 * 3600 * 1000);
            const purged = await lifecycle.purgeIfDue({ userId: 1, deletionRequestedAt: past });

            expect(purged).toBe(true);
            expect(deleted).toBe(1);
        });

        test("traite aussi les échéances des comptes qui ne se reconnectent pas", async () => {
            on("users.findDueDeletions", () => [
                { userId: 1, deletionRequestedAt: new Date(Date.now() - 31 * 86_400_000) },
            ]);
            on("users.clearFriendships", () => ({ affectedRows: 2 }));
            let purged = false;
            on("users.hardDelete", () => {
                purged = true;
                return { affectedRows: 1 };
            });
            expect(await lifecycle.purgeExpired()).toBe(1);
            expect(purged).toBe(true);
        });

        test("un compte sans demande n'est jamais touché", async () => {
            on("users.hardDelete", () => {
                throw new Error("aucun effacement ne doit avoir lieu");
            });

            expect(await lifecycle.purgeIfDue({ userId: 1, deletionRequestedAt: null })).toBe(false);
        });
    });

    describe("Export", () => {
        const emptyExport = () => {
            on("sessions.listActiveForUser", () => []);
            on("loginHistory.listForUser", () => []);
            on("organisation.listFolders", () => []);
            on("organisation.listGuildPrefs", () => []);
            on("organisation.listChannelPrefs", () => []);
            on("notifSettings.listForUser", () => []);
            on("guilds.listIdsForUser", () => []);
        };

        test("rend un fichier nommé et dit ce qu'il ne contient pas", async () => {
            emptyExport();

            const response = await auth(request(app).get("/api/v1/account/export")).expect(200);

            expect(response.headers["content-disposition"]).toContain("qweillo-alice.json");
            expect(response.body.notice).toMatch(/messages/i);
        });

        test("n'expose aucune adresse IP", async () => {
            emptyExport();
            on("loginHistory.listForUser", () => [
                { outcome: "success", deviceLabel: "Firefox", createdAt: new Date(), ipHash: "abcdef" },
            ]);

            const response = await auth(request(app).get("/api/v1/account/export")).expect(200);

            expect(JSON.stringify(response.body)).not.toContain("abcdef");
        });
    });

    describe("Consentement", () => {
        test("dit quelle version est acceptée et si elle est à jour", async () => {
            const response = await auth(request(app).get("/api/v1/account/policy")).expect(200);

            expect(response.body.currentVersion).toBe(lifecycle.POLICY_VERSION);
            expect(response.body.upToDate).toBe(false);
        });

        test("enregistre l'acceptation de la version en vigueur", async () => {
            let written = null;
            on("users.acceptPolicy", (params) => {
                written = params;
                return { affectedRows: 1 };
            });

            await auth(request(app).post("/api/v1/account/policy"))
                .send({ version: lifecycle.POLICY_VERSION })
                .expect(200);

            expect(written[0]).toBe(lifecycle.POLICY_VERSION);
        });

        test("refuse d'enregistrer une version périmée", async () => {
            on("users.acceptPolicy", () => {
                throw new Error("aucune version périmée ne doit être enregistrée");
            });

            await auth(request(app).post("/api/v1/account/policy")).send({ version: "2019-01-01" }).expect(400);
        });
    });
});
