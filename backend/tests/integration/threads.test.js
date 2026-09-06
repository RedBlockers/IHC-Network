"use strict";

const request = require("supertest");

const createApp = require("../../src/app");
const { on } = require("../helpers/db");
const { makeUser, authenticateAs } = require("../helpers/auth");
const { allowWrite } = require("../helpers/writePath");
const threadService = require("../../src/services/threadService");

const user = makeUser({ userId: 1, handle: "alice" });

function allowChannel() {
    on("access.resolveChannel", () => ({ channelId: 10, guildId: 7, type: "text", name: "général", position: 0 }));
    on("access.channelPermission", () => [{ ownerId: 1, baseEffect: "allow", targetType: null, overrideEffect: null }]);
    on("access.guildRole", () => ({ role: "member" }));
    allowWrite();
    return authenticateAs(user)(user);
}

const THREAD = {
    rootId: "500", channelId: 10, title: "Charpente de l'aile est", createdBy: 1,
    createdAt: new Date(), lastMessageAt: new Date(), replyCount: 2, autoArchiveMinutes: 4320,
};

describe("Fils de discussion", () => {
    it("n'ouvre un fil que sur un message du salon", async () => {
        const authorization = allowChannel();
        on("messages.channelOf", () => ({ channelId: 99 }));

        const response = await request(createApp())
            .post("/api/v1/channels/10/messages/500/thread")
            .set("Authorization", authorization)
            .send({ title: "Charpente" });

        expect(response.status).toBe(404);
    });

    it("refuse un second fil sur le même message", async () => {
        const authorization = allowChannel();
        on("messages.channelOf", () => ({ channelId: 10 }));
        on("threads.findByRoot", () => THREAD);

        const response = await request(createApp())
            .post("/api/v1/channels/10/messages/500/thread")
            .set("Authorization", authorization)
            .send({ title: "Charpente" });

        expect(response.status).toBe(400);
        expect(response.body.error.message).toBe("Un fil est déjà ouvert sur ce message.");
    });

    it("abonne d'office le créateur à son fil", async () => {
        const authorization = allowChannel();
        on("messages.channelOf", () => ({ channelId: 10 }));
        let created = false;
        let followed = null;
        on("threads.findByRoot", () => (created ? THREAD : null));
        on("threads.create", (params) => {
            created = true;
            expect(params).toEqual(["500", 10, "Charpente de l'aile est", 1]);
            return { affectedRows: 1 };
        });
        on("threads.follow", (params) => {
            followed = params;
            return { affectedRows: 1 };
        });

        const response = await request(createApp())
            .post("/api/v1/channels/10/messages/500/thread")
            .set("Authorization", authorization)
            .send({ title: "Charpente de l'aile est" });

        expect(response.status).toBe(201);
        expect(followed).toEqual(["500", 1]);
        expect(response.body.thread.following).toBe(true);
    });

    it("rattache la réponse au fil, met à jour son activité et notifie les abonnés sauf l'auteur", async () => {
        const authorization = allowChannel();
        on("threads.findByRoot", () => THREAD);

        let messageParams = null;
        let touched = null;
        on("messages.create", (params) => {
            messageParams = params;
            return { affectedRows: 1 };
        });
        on("messages.findById", () => ({
            messageId: "700", channelId: 10, content: "je peux aider demain", createdAt: new Date(),
            editedAt: null, encryptionEpoch: null, userId: 1, handle: "alice", displayName: "Alice", avatar: null,
        }));
        on("threads.touch", (params) => {
            touched = params;
            return { affectedRows: 1 };
        });
        on("threads.follow", () => ({ affectedRows: 1 }));
        on("threads.listFollowers", () => [{ userId: 1 }, { userId: 2 }, { userId: 3 }]);

        const notified = [];
        on("notifications.create", (params) => {
            notified.push(params[0]);
            return { insertId: notified.length };
        });
        on("notifications.findByIdForUser", () => null);

        const response = await request(createApp())
            .post("/api/v1/channels/10/threads/500/messages")
            .set("Authorization", authorization)
            .send({ content: "je peux aider demain" });

        expect(response.status).toBe(201);
        expect(messageParams[5]).toBe("500");
        expect(touched).toEqual(["500"]);
        expect(notified.sort()).toEqual([2, 3]);
    });

    it("refuse une réponse dans un fil d'un autre salon", async () => {
        const authorization = allowChannel();
        on("threads.findByRoot", () => ({ ...THREAD, channelId: 42 }));

        const response = await request(createApp())
            .post("/api/v1/channels/10/threads/500/messages")
            .set("Authorization", authorization)
            .send({ content: "hors sujet" });

        expect(response.status).toBe(404);
    });

    it("refuse une réponse quand l'auteur est réduit au silence", async () => {
        const authorization = allowChannel();
        on("moderation.findActiveSanction", () => ({ sanctionId: 1, type: "timeout" }));
        on("threads.findByRoot", () => THREAD);

        const response = await request(createApp())
            .post("/api/v1/channels/10/threads/500/messages")
            .set("Authorization", authorization)
            .send({ content: "je passe outre" });

        expect(response.status).toBe(403);
    });

    it("suit et cesse de suivre un fil", async () => {
        const authorization = allowChannel();
        on("threads.findByRoot", () => THREAD);
        let action = null;
        on("threads.follow", () => {
            action = "follow";
            return { affectedRows: 1 };
        });
        on("threads.unfollow", () => {
            action = "unfollow";
            return { affectedRows: 1 };
        });

        const followed = await request(createApp())
            .put("/api/v1/channels/10/threads/500/follow")
            .set("Authorization", authorization);
        expect(followed.status).toBe(200);
        expect(action).toBe("follow");
        expect(followed.body.thread.following).toBe(true);

        const unfollowed = await request(createApp())
            .delete("/api/v1/channels/10/threads/500/follow")
            .set("Authorization", authorization);
        expect(unfollowed.status).toBe(200);
        expect(action).toBe("unfollow");
        expect(unfollowed.body.thread.following).toBe(false);
    });

    it("déduit l'archivage de la dernière activité, sans travail de fond", () => {
        const fresh = { lastMessageAt: new Date(), autoArchiveMinutes: 60 };
        const stale = { lastMessageAt: new Date(Date.now() - 2 * 3_600_000), autoArchiveMinutes: 60 };

        expect(threadService.isArchived(fresh)).toBe(false);
        expect(threadService.isArchived(stale)).toBe(true);
        expect(threadService.isArchived({ ...stale, lastMessageAt: new Date() })).toBe(false);
    });
});
