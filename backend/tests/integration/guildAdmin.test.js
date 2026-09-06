"use strict";

const request = require("supertest");
const createApp = require("../../src/app");
const { on } = require("../helpers/db");
const { makeUser, authenticateAs } = require("../helpers/auth");
const { idAtTime } = require("../../src/infra/snowflake");

describe("Administration d'une communauté", () => {
    const alice = makeUser({ userId: 1, handle: "alice" });
    const app = createApp();
    let token;

    const allow = () =>
        on("access.guildPermission", () => [{ ownerId: 1, effect: "allow" }]);

    beforeEach(() => {
        token = authenticateAs(alice);
        on("guilds.findById", () => [{ guildId: 7, name: "Laguna", ownerId: 1 }]);
        on("guilds.findRole", () => [{ role: "owner" }]);
        allow();
    });

    const member = (userId, overrides = {}) => ({
        userId,
        handle: `membre${userId}`,
        displayName: `Membre ${userId}`,
        avatar: null,
        isBot: 0,
        role: "member",
        joinedAt: "2026-08-01T10:00:00.000Z",
        accountCreatedAt: "2026-01-01T10:00:00.000Z",
        roles: JSON.stringify([]),
        ...overrides,
    });

    describe("Répertoire des membres", () => {
        test("rend une page et situe le résultat dans l'effectif total", async () => {
            on("guilds.searchMembers", () => [member(2), member(3)]);
            on("guilds.countMembers", () => ({ total: 340, joinedWeek: 12, joinedMonth: 48, bots: 2 }));

            const response = await request(app)
                .get("/api/v1/guilds/7/members?limit=2")
                .set("Authorization", token(alice))
                .expect(200);

            expect(response.body.members).toHaveLength(2);
            expect(response.body.total).toBe(340);
            expect(response.body.hasMore).toBe(false);
        });

        test("annonce la suite sans rendre la ligne de sonde", async () => {
            on("guilds.searchMembers", () => [member(2), member(3), member(4)]);
            on("guilds.countMembers", () => ({ total: 3, joinedWeek: 0, joinedMonth: 0, bots: 0 }));

            const response = await request(app)
                .get("/api/v1/guilds/7/members?limit=2")
                .set("Authorization", token(alice))
                .expect(200);

            expect(response.body.members).toHaveLength(2);
            expect(response.body.hasMore).toBe(true);
        });

        test("la recherche voyage en paramètre lié, pas dans le texte de la requête", async () => {
            let captured = null;
            on("guilds.searchMembers", (params, sql) => {
                captured = { params, sql };
                return [];
            });
            on("guilds.countMembers", () => ({ total: 0 }));

            await request(app)
                .get("/api/v1/guilds/7/members?search=o%27brien")
                .set("Authorization", token(alice))
                .expect(200);

            expect(captured.sql).toContain("u.handle LIKE ?");
            expect(captured.sql).not.toContain("o'brien");
            expect(captured.params).toContain("%o'brien%");
        });

        test("le tri est choisi dans une liste close", async () => {
            let seen = null;
            on("guilds.searchMembers", (params, sql) => {
                seen = sql;
                return [];
            });
            on("guilds.countMembers", () => ({ total: 0 }));

            await request(app)
                .get("/api/v1/guilds/7/members?sort=name")
                .set("Authorization", token(alice))
                .expect(200);

            expect(seen).toContain("u.displayName");

            await request(app)
                .get("/api/v1/guilds/7/members?sort=; DROP TABLE users")
                .set("Authorization", token(alice))
                .expect(400);
        });

        test("filtrer par rôle passe par une existence, pas par une jointure qui duplique", async () => {
            let captured = null;
            on("guilds.searchMembers", (params, sql) => {
                captured = { params, sql };
                return [];
            });
            on("guilds.countMembers", () => ({ total: 0 }));

            await request(app)
                .get("/api/v1/guilds/7/members?roleId=42")
                .set("Authorization", token(alice))
                .expect(200);

            expect(captured.sql).toContain("EXISTS");
            expect(captured.params).toContain(42);
        });

        test("refuse la lecture à qui ne modère pas", async () => {
            on("access.guildPermission", () => [{ ownerId: 99, effect: "deny" }]);

            await request(app)
                .get("/api/v1/guilds/7/members")
                .set("Authorization", token(alice))
                .expect(403);
        });
    });

    describe("Vue d'ensemble", () => {
        const stubCounts = () => {
            on("guilds.countMembers", () => ({ total: 200, joinedWeek: 10, joinedMonth: 35, bots: 3 }));
            on("guilds.countSanctions", () => ({ bans: 4, timeouts: 2, lastWeek: 1 }));
            on("guilds.countOpenReports", () => ({ open: 5, oldestAt: "2026-08-10T08:00:00.000Z" }));
            on("guilds.countActivity", () => ({ messagesWeek: 1200, activeAuthors: 50 }));
            on("guilds.countStructure", () => ({ channels: 12, roles: 6, invites: 3 }));
            on("attachments.sumBytesForGuild", () => ({ used: 1024 * 1024 * 512, files: 40 }));
            on("guilds.countHealth", () => ({
                members: 200,
                onboarded: 172,
                retained: 61,
                eligible: 100,
                sanctionsMonth: 4,
            }));
        };

        test("rassemble les chiffres qui appellent une décision", async () => {
            stubCounts();

            const response = await request(app)
                .get("/api/v1/guilds/7/overview")
                .set("Authorization", token(alice))
                .expect(200);

            expect(response.body.members.total).toBe(200);
            expect(response.body.moderation.openReports).toBe(5);
            expect(response.body.structure.channels).toBe(12);
            expect(response.body.activity.activeShare).toBe(25);
        });

        test("ne prétend pas calculer une part d'actifs sans effectif", async () => {
            stubCounts();
            on("guilds.countMembers", () => ({ total: 0, joinedWeek: 0, joinedMonth: 0, bots: 0 }));
            on("guilds.countActivity", () => ({ messagesWeek: 0, activeAuthors: 0 }));

            const response = await request(app)
                .get("/api/v1/guilds/7/overview")
                .set("Authorization", token(alice))
                .expect(200);

            expect(response.body.activity.activeShare).toBeNull();
        });

        test("la fenêtre d'activité borne l'identifiant, jamais la date", async () => {
            stubCounts();
            let captured = null;
            on("guilds.countActivity", (params, sql) => {
                captured = { params, sql };
                return { messagesWeek: 0, activeAuthors: 0 };
            });

            await request(app)
                .get("/api/v1/guilds/7/overview")
                .set("Authorization", token(alice))
                .expect(200);

            expect(captured.sql).toContain("msg.messageId >= ?");
            expect(captured.sql).not.toContain("INTERVAL 7 DAY");

            const now = Date.now();
            const expected = BigInt(idAtTime(now - 7 * 24 * 3600 * 1000));
            const actual = BigInt(captured.params[1]);
            const minute = BigInt(idAtTime(now)) - BigInt(idAtTime(now - 60_000));
            expect(actual > expected - minute && actual < expected + minute).toBe(true);
        });

        test("refuse la vue d'ensemble à qui ne lit pas le journal", async () => {
            on("access.guildPermission", () => [{ ownerId: 99, effect: "deny" }]);

            await request(app)
                .get("/api/v1/guilds/7/overview")
                .set("Authorization", token(alice))
                .expect(403);
        });
    });
});

describe("Santé de la communauté", () => {
    const alice = makeUser({ userId: 1, handle: "alice" });
    const app = createApp();
    let token;

    const base = (health) => {
        on("guilds.countMembers", () => ({ total: 200, joinedWeek: 10, joinedMonth: 35, bots: 3 }));
        on("guilds.countSanctions", () => ({ bans: 0, timeouts: 0, lastWeek: 0 }));
        on("guilds.countOpenReports", () => ({ open: 0, oldestAt: null }));
        on("guilds.countActivity", () => ({ messagesWeek: 0, activeAuthors: 0 }));
        on("guilds.countStructure", () => ({ channels: 1, roles: 1, invites: 0 }));
        on("guilds.countHealth", () => health);
        on("attachments.sumBytesForGuild", () => ({ used: 0, files: 0 }));
    };

    beforeEach(() => {
        token = authenticateAs(alice);
        on("guilds.findById", () => [{ guildId: 7, name: "Laguna", ownerId: 1, accent: "#12b5a2" }]);
        on("access.guildPermission", () => [{ ownerId: 1, effect: "allow" }]);
    });

    const overview = () =>
        request(app).get("/api/v1/guilds/7/overview").set("Authorization", token(alice));

    test("rend les taux d'accueil et de rétention", async () => {
        base({ members: 200, onboarded: 172, retained: 61, eligible: 100, sanctionsMonth: 4 });

        const response = await overview().expect(200);

        expect(response.body.health.onboardingRate).toBe(86);
        expect(response.body.health.retentionRate).toBe(61);
    });

    test("ne calcule pas une rétention sans recul", async () => {
        base({ members: 12, onboarded: 4, retained: 0, eligible: 0, sanctionsMonth: 0 });

        const response = await overview().expect(200);

        expect(response.body.health.retentionRate).toBeNull();
        expect(response.body.health.onboardingRate).toBe(33);
    });

    test("vérifie le contraste de l'accent sur les deux surfaces", async () => {
        base({ members: 1, onboarded: 0, retained: 0, eligible: 0, sanctionsMonth: 0 });

        const response = await overview().expect(200);

        expect(response.body.health.accentContrast).toEqual(
            expect.objectContaining({ ok: expect.any(Boolean), ratio: expect.any(Number) })
        );
    });

    test("sans accent choisi, il n'y a rien à vérifier", async () => {
        on("guilds.findById", () => [{ guildId: 7, name: "Laguna", ownerId: 1, accent: null }]);
        base({ members: 1, onboarded: 0, retained: 0, eligible: 0, sanctionsMonth: 0 });

        const response = await overview().expect(200);

        expect(response.body.health.accentContrast).toBeNull();
    });
});

describe("Quota de stockage", () => {
    const alice = makeUser({ userId: 1, handle: "alice" });
    const app = createApp();
    let token;

    const withStorage = (used) => {
        on("guilds.countMembers", () => ({ total: 1, joinedWeek: 0, joinedMonth: 0, bots: 0 }));
        on("guilds.countSanctions", () => ({ bans: 0, timeouts: 0, lastWeek: 0 }));
        on("guilds.countOpenReports", () => ({ open: 0, oldestAt: null }));
        on("guilds.countActivity", () => ({ messagesWeek: 0, activeAuthors: 0 }));
        on("guilds.countStructure", () => ({ channels: 1, roles: 1, invites: 0 }));
        on("guilds.countHealth", () => ({ members: 1, onboarded: 0, retained: 0, eligible: 0, sanctionsMonth: 0 }));
        on("attachments.sumBytesForGuild", () => ({ used, files: 10 }));
    };

    beforeEach(() => {
        token = authenticateAs(alice);
        on("guilds.findById", () => [{ guildId: 7, name: "Laguna", ownerId: 1, accent: null }]);
        on("access.guildPermission", () => [{ ownerId: 1, effect: "allow" }]);
    });

    const overview = () => request(app).get("/api/v1/guilds/7/overview").set("Authorization", token(alice));

    test("compte l'espace réellement occupé", async () => {
        withStorage(1024 * 1024 * 1024);

        const response = await overview().expect(200);

        expect(response.body.storage.usedBytes).toBe(1024 * 1024 * 1024);
        expect(response.body.storage.share).toBe(20);
        expect(response.body.storage.level).toBe("ok");
    });

    test("prévient avant d'être plein", async () => {
        withStorage(Math.round(5 * 1024 * 1024 * 1024 * 0.9));

        expect((await overview().expect(200)).body.storage.level).toBe("warning");
    });

    test("distingue « bientôt plein » de « plein »", async () => {
        withStorage(6 * 1024 * 1024 * 1024);

        expect((await overview().expect(200)).body.storage.level).toBe("full");
    });

    test("compte aussi les envois jamais publiés", async () => {
        withStorage(0);
        let sql = null;
        on("attachments.sumBytesForGuild", (_params, statement) => {
            sql = statement;
            return { used: 0, files: 0 };
        });

        await overview().expect(200);

        expect(sql).not.toContain("a.messageId IS NOT NULL");
        expect(sql).toContain("FROM message_attachments");
    });
});
