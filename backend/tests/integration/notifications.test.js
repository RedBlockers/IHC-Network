"use strict";

const request = require("supertest");
const createApp = require("../../src/app");
const { on } = require("../helpers/db");
const { allowWrite } = require("../helpers/writePath");
const { makeUser, authenticateAs } = require("../helpers/auth");
const realtime = require("../../src/realtime");

describe("Mentions et notifications", () => {
    const alice = makeUser({ userId: 1, handle: "alice" });
    const bob = makeUser({ userId: 2, handle: "bob" });
    const app = createApp();

    afterEach(() => jest.restoreAllMocks());

    beforeEach(() => {
        realtime.__reset();
        const token = authenticateAs(alice, bob);
        app.locals.token = token;
        on("access.resolveChannel", () => [{ channelId: 10, type: "text", guildId: 4, friendshipId: null }]);
        allowWrite();
        on("access.channelPermission", () => [{ ownerId: alice.userId, baseEffect: null, targetType: null, overrideEffect: null }]);
    });

    it("notifie uniquement un membre réellement accessible mentionné dans le message", async () => {
        on("messages.create", () => ({ affectedRows: 1 }));
        on("messages.findById", () => ({
            messageId: "7168291357943578624", channelId: 10, content: "Salut @bob", createdAt: new Date(),
            userId: 1, handle: "alice", displayName: "Alice", avatar: "/a.webp",
        }));
        on("messages.resolveMentions", (params, sql) => {
            expect(sql).toContain("gm.guildId = c.guildId");
            expect(params).toEqual([10, "bob", 1]);
            return [{ userId: 2 }];
        });
        on("notifications.create", (params) => {
            expect(params).toEqual([2, 1, "mention", 10, "7168291357943578624"]);
            return { affectedRows: 1, insertId: 12 };
        });
        on("notifications.findByIdForUser", () => ({
            notificationId: 12, type: "mention", channelId: 10, messageId: "7168291357943578624",
            readAt: null, createdAt: new Date(), actorId: 1, actorHandle: "alice", actorDisplayName: "Alice",
            actorAvatar: "/a.webp", channelName: "général", guildId: 4, guildName: "Atelier",
        }));

        const response = await request(app)
            .post("/api/v1/channels/10/messages")
            .set("Authorization", app.locals.token(alice))
            .send({ content: "Salut @bob" });

        expect(response.status).toBe(201);
        expect(realtime.__emissions).toEqual(expect.arrayContaining([
            expect.objectContaining({ target: "user", userId: 2, event: "notification:new" }),
        ]));
    });

    it("liste et marque seulement les notifications du compte connecté", async () => {
        on("notifications.listForUser", (params, sql) => {
            expect(sql).toContain("n.userId = ?");
            expect(params).toEqual([1]);
            return [{ notificationId: 12, type: "mention", readAt: null }];
        });
        on("notifications.countUnread", () => ({ total: 1, mentions: 1, threads: 0 }));
        on("notifications.markRead", (params, sql) => {
            expect(sql).toContain("userId = ?");
            expect(params).toEqual([12, 1]);
            return { affectedRows: 1 };
        });

        const list = await request(app).get("/api/v1/notifications").set("Authorization", app.locals.token(alice));
        expect(list.status).toBe(200);
        expect(list.body.unreadCount).toBe(1);

        const read = await request(app).patch("/api/v1/notifications/12/read").set("Authorization", app.locals.token(alice));
        expect(read.status).toBe(204);
    });

    it("réserve @everyone et @here aux membres autorisés", async () => {
        on("access.channelPermission", (params) => [{
            ownerId: 99,
            baseEffect: params[1] === "MENTION_EVERYONE" ? "deny" : "allow",
            targetType: null,
            overrideEffect: null,
        }]);

        const response = await request(app)
            .post("/api/v1/channels/10/messages")
            .set("Authorization", app.locals.token(alice))
            .send({ content: "Point important @everyone" });

        expect(response.status).toBe(403);
        expect(response.body.error.details.permission).toBe("MENTION_EVERYONE");
    });

    it("crée une mention persistante pour chaque membre visible avec @everyone", async () => {
        on("access.channelPermission", () => [{ ownerId: alice.userId, baseEffect: null, targetType: null, overrideEffect: null }]);
        on("messages.create", () => ({ affectedRows: 1 }));
        on("messages.findById", () => ({
            messageId: "7168291357943578625", channelId: 10, content: "Annonce @everyone", createdAt: new Date(),
            userId: 1, handle: "alice", displayName: "Alice", avatar: "/a.webp",
        }));
        on("messages.listGuildMentionRecipients", (params, sql) => {
            expect(params).toEqual([10, 1]);
            expect(sql).toContain("channel_permission_overrides");
            return [{ userId: 2 }];
        });
        on("notifications.create", () => ({ affectedRows: 1, insertId: 13 }));
        on("notifications.findByIdForUser", () => ({
            notificationId: 13, type: "mention", channelId: 10, messageId: "7168291357943578625",
            readAt: null, createdAt: new Date(), actorId: 1, actorHandle: "alice", actorDisplayName: "Alice",
            actorAvatar: "/a.webp", channelName: "général", guildId: 4, guildName: "Atelier",
        }));

        const response = await request(app)
            .post("/api/v1/channels/10/messages")
            .set("Authorization", app.locals.token(alice))
            .send({ content: "Annonce @everyone" });

        expect(response.status).toBe(201);
        expect(realtime.__emissions).toEqual(expect.arrayContaining([
            expect.objectContaining({ target: "user", userId: 2, event: "notification:new" }),
        ]));
    });

    it("limite @here aux membres connectés sans écrire dans la boîte de réception", async () => {
        const presenceService = require("../../src/services/presenceService");
        jest.spyOn(presenceService, "areOnline").mockResolvedValue(new Map([[2, true], [3, false]]));
        on("access.channelPermission", () => [{ ownerId: alice.userId, baseEffect: null, targetType: null, overrideEffect: null }]);
        on("messages.create", () => ({ affectedRows: 1 }));
        on("messages.findById", () => ({
            messageId: "7168291357943578626", channelId: 10, content: "Disponible @here", createdAt: new Date(),
            userId: 1, handle: "alice", displayName: "Alice", avatar: "/a.webp",
        }));
        on("messages.listGuildMentionRecipients", () => [{ userId: 2 }, { userId: 3 }]);

        const response = await request(app)
            .post("/api/v1/channels/10/messages")
            .set("Authorization", app.locals.token(alice))
            .send({ content: "Disponible @here" });

        expect(response.status).toBe(201);
        expect(realtime.__emissions).toEqual(expect.arrayContaining([
            expect.objectContaining({ target: "user", userId: 2, event: "mention:here" }),
        ]));
        expect(realtime.__emissions.some((entry) => entry.target === "user" && entry.userId === 3 && entry.event === "mention:here")).toBe(false);
        expect(realtime.__emissions.some((entry) => entry.event === "notification:new")).toBe(false);
    });
});

describe("Réglages de notification appliqués à la diffusion", () => {
    const ROW = (notificationId, messageId) => ({
        notificationId, type: "mention", channelId: 10, messageId, readAt: null,
        createdAt: new Date(), actorId: 1, actorHandle: "alice", actorDisplayName: "Alice", actorAvatar: null,
        channelName: "général", guildId: 4, guildName: "Atelier",
    });

    it("écrit la notification mais retire le droit d'interrompre quand le salon est en sourdine", async () => {
        const realtime = require("../../src/realtime");
        realtime.__reset();

        on("notifSettings.findForChannel", () => [{ scope: "channel", targetId: 10, level: "none" }]);
        on("notifSettings.findQuietHours", () => ({ quietHoursStart: null, quietHoursEnd: null, desktopNotifications: 1 }));
        on("notifications.create", () => ({ insertId: 12, affectedRows: 1 }));
        on("notifications.findByIdForUser", () => ROW(12, "700"));

        const notificationService = require("../../src/services/notificationService");
        await notificationService.createForUser({ userId: 2, actorId: 1, type: "mention", channelId: 10, messageId: "700" });

        const emitted = realtime.__emissions.find((e) => e.event === "notification:new");
        expect(emitted).toBeTruthy();
        expect(emitted.payload.interrupt).toBe(false);
        expect(emitted.payload.suppressedBy).toBe("muted");
    });

    it("laisse interrompre quand rien ne s'y oppose", async () => {
        const realtime = require("../../src/realtime");
        realtime.__reset();

        on("notifSettings.findForChannel", () => []);
        on("notifSettings.findQuietHours", () => ({ quietHoursStart: null, quietHoursEnd: null, desktopNotifications: 1 }));
        on("notifications.create", () => ({ insertId: 13, affectedRows: 1 }));
        on("notifications.findByIdForUser", () => ROW(13, "701"));

        const notificationService = require("../../src/services/notificationService");
        await notificationService.createForUser({ userId: 2, actorId: 1, type: "mention", channelId: 10, messageId: "701" });

        const emitted = realtime.__emissions.find((e) => e.event === "notification:new");
        expect(emitted.payload.interrupt).toBe(true);
    });

    it("suspend l'interruption pendant les heures calmes sans perdre la notification", async () => {
        const realtime = require("../../src/realtime");
        realtime.__reset();

        on("notifSettings.findForChannel", () => []);
        on("notifSettings.findQuietHours", () => ({ quietHoursStart: 0, quietHoursEnd: 23, desktopNotifications: 1 }));
        on("notifications.create", () => ({ insertId: 14, affectedRows: 1 }));
        on("notifications.findByIdForUser", () => ROW(14, "702"));

        const notificationService = require("../../src/services/notificationService");
        await notificationService.createForUser({ userId: 2, actorId: 1, type: "mention", channelId: 10, messageId: "702" });

        const emitted = realtime.__emissions.find((e) => e.event === "notification:new");
        expect(emitted.payload.notificationId).toBe(14);
        if (new Date().getHours() !== 23) {
            expect(emitted.payload.interrupt).toBe(false);
            expect(emitted.payload.suppressedBy).toBe("quiet-hours");
        }
    });
});
