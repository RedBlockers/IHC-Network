"use strict";

const request = require("supertest");
const createApp = require("../../src/app");
const { on } = require("../helpers/db");
const { makeUser, authenticateAs } = require("../helpers/auth");

const row = (notificationId, type, overrides = {}) => ({
    notificationId,
    type,
    channelId: 30,
    messageId: "900",
    readAt: null,
    createdAt: "2026-08-13T10:00:00.000Z",
    actorId: 2,
    actorHandle: "bob",
    actorDisplayName: "Bob",
    actorAvatar: null,
    channelName: "taverne",
    guildId: 7,
    guildName: "Laguna",
    ...overrides,
});

describe("Boîte de réception", () => {
    const alice = makeUser({ userId: 1, handle: "alice" });
    const app = createApp();
    let token;

    beforeEach(() => {
        token = authenticateAs(alice);
    });

    test("renvoie une page et le total réel des non-lus, pas celui de la page", async () => {
        on("notifications.listForUser", () => [row(5, "mention"), row(4, "reply")]);
        on("notifications.countUnread", () => ({ total: 40, mentions: 12, threads: 3 }));

        const response = await request(app).get("/api/v1/notifications?limit=2").set("Authorization", token(alice)).expect(200);

        expect(response.body.notifications).toHaveLength(2);
        expect(response.body.unreadCount).toBe(40);
        expect(response.body.counts).toEqual({ total: 40, mentions: 12, threads: 3 });
    });

    test("annonce la suite et rend un curseur quand il reste des lignes", async () => {
        on("notifications.listForUser", () => [row(9, "mention"), row(8, "mention"), row(7, "mention")]);
        on("notifications.countUnread", () => ({ total: 3, mentions: 3, threads: 0 }));

        const response = await request(app).get("/api/v1/notifications?limit=2").set("Authorization", token(alice)).expect(200);

        expect(response.body.notifications).toHaveLength(2);
        expect(response.body.hasMore).toBe(true);
        expect(response.body.nextCursor).toBe("8");
    });

    test("ne rend pas de curseur quand la page est la dernière", async () => {
        on("notifications.listForUser", () => [row(2, "mention")]);
        on("notifications.countUnread", () => ({ total: 1, mentions: 1, threads: 0 }));

        const response = await request(app).get("/api/v1/notifications?limit=30").set("Authorization", token(alice)).expect(200);

        expect(response.body.hasMore).toBe(false);
        expect(response.body.nextCursor).toBeNull();
    });

    test("l'onglet mentions couvre les citations et les réponses", async () => {
        let seen = null;
        on("notifications.listForUser", (params, sql) => {
            seen = sql;
            return [row(5, "reply")];
        });
        on("notifications.countUnread", () => ({ total: 1, mentions: 1, threads: 0 }));

        await request(app).get("/api/v1/notifications?filter=mentions").set("Authorization", token(alice)).expect(200);

        expect(seen).toContain("n.type IN ('mention','reply')");
    });

    test("l'onglet fils ne retient que les fils", async () => {
        let seen = null;
        on("notifications.listForUser", (params, sql) => {
            seen = sql;
            return [row(6, "thread")];
        });
        on("notifications.countUnread", () => ({ total: 1, mentions: 0, threads: 1 }));

        await request(app).get("/api/v1/notifications?filter=threads").set("Authorization", token(alice)).expect(200);

        expect(seen).toContain("n.type = 'thread'");
        expect(seen).not.toContain("mention");
    });

    test("refuse un onglet inventé plutôt que de retomber en silence sur tout", async () => {
        await request(app).get("/api/v1/notifications?filter=inbox-secrete").set("Authorization", token(alice)).expect(400);
    });

    test("le curseur passe en paramètre lié, jamais dans le texte de la requête", async () => {
        let captured = null;
        on("notifications.listForUser", (params, sql) => {
            captured = { sql, params };
            return [];
        });
        on("notifications.countUnread", () => ({ total: 0, mentions: 0, threads: 0 }));

        await request(app).get("/api/v1/notifications?before=4242").set("Authorization", token(alice)).expect(200);

        expect(captured.sql).toContain("n.notificationId < ?");
        expect(captured.params).toContain("4242");
    });

    test("refuse un curseur qui n'est pas un identifiant", async () => {
        await request(app).get("/api/v1/notifications?before=4242;DROP").set("Authorization", token(alice)).expect(400);
    });

    test("« tout marquer comme lu » se limite à l'onglet regardé", async () => {
        let seen = null;
        on("notifications.markAllRead", (params, sql) => {
            seen = sql;
            return { affectedRows: 3 };
        });

        await request(app).patch("/api/v1/notifications/read?filter=mentions").set("Authorization", token(alice)).expect(204);

        expect(seen).toContain("n.type IN ('mention','reply')");
    });

    test("« tout marquer comme lu » sans onglet vide bien tout", async () => {
        let seen = null;
        on("notifications.markAllRead", (params, sql) => {
            seen = sql;
            return { affectedRows: 9 };
        });

        await request(app).patch("/api/v1/notifications/read").set("Authorization", token(alice)).expect(204);

        expect(seen).not.toContain("n.type");
    });
});

describe("Résumé", () => {
    const alice = makeUser({ userId: 1, handle: "alice" });
    const app = createApp();
    let token;

    beforeEach(() => {
        token = authenticateAs(alice);
    });

    test("regroupe par salon et met en avant ce qui cite la personne", async () => {
        on("notifSettings.findQuietHours", () => ({
            quietHoursStart: null,
            quietHoursEnd: null,
            desktopNotifications: 1,
            digestFrequency: "daily",
        }));
        on("notifSettings.listForUser", () => []);
        on("notifications.digestSince", () => [
            { channelId: 30, channelName: "taverne", guildId: 7, guildName: "Laguna", total: 4, mentions: 2, lastAt: "2026-08-13T09:00:00.000Z" },
            { channelId: 31, channelName: "annonces", guildId: 7, guildName: "Laguna", total: 6, mentions: 0, lastAt: "2026-08-13T08:00:00.000Z" },
        ]);

        const response = await request(app).get("/api/v1/notifications/digest").set("Authorization", token(alice)).expect(200);

        expect(response.body.enabled).toBe(true);
        expect(response.body.total).toBe(10);
        expect(response.body.mentions).toBe(2);
        expect(response.body.channels).toHaveLength(2);
        expect(response.body.since).toEqual(expect.any(String));
    });

    test("la fenêtre hebdomadaire remonte plus loin que la quotidienne", async () => {
        const windows = {};
        on("notifSettings.listForUser", () => []);
        on("notifications.digestSince", (params) => {
            windows[params[1].toISOString()] = true;
            return [];
        });

        for (const frequency of ["daily", "weekly"]) {
            on("notifSettings.findQuietHours", () => ({
                quietHoursStart: null,
                quietHoursEnd: null,
                desktopNotifications: 1,
                digestFrequency: frequency,
            }));
            await request(app).get("/api/v1/notifications/digest").set("Authorization", token(alice)).expect(200);
        }

        const [first, second] = Object.keys(windows).sort();
        expect(new Date(second) - new Date(first)).toBeGreaterThan(5 * 24 * 3600 * 1000);
    });

    test("coupé, il le dit au lieu de rendre un résumé vide", async () => {
        on("notifSettings.findQuietHours", () => ({
            quietHoursStart: null,
            quietHoursEnd: null,
            desktopNotifications: 1,
            digestFrequency: "off",
        }));
        on("notifSettings.listForUser", () => []);

        const response = await request(app).get("/api/v1/notifications/digest").set("Authorization", token(alice)).expect(200);

        expect(response.body.enabled).toBe(false);
        expect(response.body.channels).toEqual([]);
    });

    test("régler les heures calmes ne rallume pas un résumé coupé", async () => {
        let written = null;
        on("notifSettings.findQuietHours", () => ({
            quietHoursStart: null,
            quietHoursEnd: null,
            desktopNotifications: 1,
            digestFrequency: "off",
        }));
        on("notifSettings.listForUser", () => []);
        on("notifSettings.updateQuietHours", (params) => {
            written = params;
            return { affectedRows: 1 };
        });

        await request(app).put("/api/v1/notifications/settings/quiet-hours").set("Authorization", token(alice))
            .send({ start: 22, end: 7, desktopNotifications: true })
            .expect(200);

        expect(written).toContain("off");
    });

    test("refuse une fréquence inconnue", async () => {
        await request(app).put("/api/v1/notifications/settings/quiet-hours").set("Authorization", token(alice))
            .send({ start: null, end: null, desktopNotifications: true, digestFrequency: "hourly" })
            .expect(400);
    });
});

describe("Marquer un salon entier comme lu", () => {
    const alice = makeUser({ userId: 1, handle: "alice" });
    const app = createApp();
    let token;

    beforeEach(() => {
        token = authenticateAs(alice);
    });

    test("le serveur résout lui-même le dernier message", async () => {
        let written = null;
        on("messages.lastIdIn", () => ({ messageId: "7168291357943578624" }));
        on("notifSettings.markRead", (params) => {
            written = params;
            return { affectedRows: 1 };
        });

        const response = await request(app)
            .put("/api/v1/notifications/read/30")
            .set("Authorization", token(alice))
            .expect(200);

        expect(response.body.lastReadMessageId).toBe("7168291357943578624");
        expect(written).toContain("7168291357943578624");
    });

    test("un salon vide n'écrit aucune position de lecture", async () => {
        on("messages.lastIdIn", () => ({ messageId: null }));
        on("notifSettings.markRead", () => {
            throw new Error("aucune position ne doit être posée sur un salon vide");
        });

        const response = await request(app)
            .put("/api/v1/notifications/read/30")
            .set("Authorization", token(alice))
            .expect(200);

        expect(response.body.lastReadMessageId).toBeNull();
    });
});
