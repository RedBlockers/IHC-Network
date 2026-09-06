"use strict";

const request = require("supertest");
const createApp = require("../../src/app");
const { on } = require("../helpers/db");
const { makeUser, authenticateAs } = require("../helpers/auth");
const { allowWrite } = require("../helpers/writePath");
const realtime = require("../helpers/realtimeMock");
const { RoomServiceClient } = require("livekit-server-sdk");

const member = makeUser({ userId: 5, handle: "camille" });
const manager = makeUser({ userId: 8, handle: "noe" });
const channel = (type, overrides = {}) => ({
    channelId: 10,
    guildId: 7,
    type,
    name: "atelier",
    description: "",
    position: 0,
    ...overrides,
});

function access(type, user = member, overrides = {}) {
    on("access.resolveChannel", () => channel(type, overrides));
    on("channels.findById", () => channel(type, overrides));
    on("access.channelPermission", () => [
        { ownerId: 99, baseEffect: "allow", targetType: null, overrideEffect: null },
    ]);
    on("access.channelPermissions", () =>
        ["VIEW_CHANNEL", "READ_MESSAGE_HISTORY", "SEND_MESSAGES"].map((permission) => ({
            ownerId: 99,
            permission,
            baseEffect: "allow",
            targetType: null,
            overrideEffect: null,
        }))
    );
    on("access.guildRole", () => ({ role: "member" }));
    on("access.guildPermission", (params) => [{ ownerId: 8, effect: params[0] === 8 ? "allow" : "deny" }]);
    on("guilds.findById", () => ({ guildId: 7, ownerId: 8 }));
    allowWrite();
    return authenticateAs(member, manager)(user);
}

describe("Parcours et frontières des types de salon", () => {
    it("applique la même priorité des droits dans le contexte et dans les actions", async () => {
        const authorization = access("text");
        on("access.channelPermissions", () => [
            { ownerId: 99, permission: "SEND_MESSAGES", baseEffect: "allow" },
            { ownerId: 99, permission: "SEND_MESSAGES", targetType: "role", overrideEffect: "deny" },
            { ownerId: 99, permission: "READ_MESSAGE_HISTORY", baseEffect: "deny" },
            { ownerId: 99, permission: "READ_MESSAGE_HISTORY", targetType: "member", overrideEffect: "allow" },
        ]);
        const response = await request(createApp())
            .get("/api/v1/channels/10/context")
            .set("Authorization", authorization);
        expect(response.status).toBe(200);
        expect(response.body.permissions).not.toContain("SEND_MESSAGES");
        expect(response.body.permissions).toContain("READ_MESSAGE_HISTORY");
        expect(response.body.writable).toBe(false);
    });
    afterEach(() => jest.restoreAllMocks());
    it("accorde et retire la parole sur une scène avec des permissions persistantes", async () => {
        const authorization = access("stage", manager);
        const update = jest.spyOn(RoomServiceClient.prototype, "updateParticipant").mockResolvedValue({});
        const rules = [];
        on("stage.permission", (params) => {
            rules.push(params);
            return { affectedRows: 1 };
        });
        const response = await request(createApp())
            .patch("/api/v1/channels/10/speakers/5")
            .set("Authorization", authorization)
            .send({ speaking: true });
        expect(response.status).toBe(200);
        expect(response.body.publish.microphone).toBe(true);
        expect(update.mock.calls[0][1]).toBe("user:5");
        expect(rules).toContainEqual([10, 5, "SPEAK", "allow"]);
        const closed = await request(createApp())
            .patch("/api/v1/channels/10/speakers/5")
            .set("Authorization", authorization)
            .send({ speaking: false });
        expect(closed.status).toBe(200);
        expect(closed.body.publish.microphone).toBe(false);
        expect(rules).toContainEqual([10, 5, "SPEAK", "deny"]);
    });
    it.each(["VIEW_CHANNEL", "CONNECT"])("ne donne pas la parole à une cible privée de %s", async (denied) => {
        const authorization = access("stage", manager);
        on("access.channelPermission", (params) => [
            {
                ownerId: 99,
                baseEffect: params[0] === 5 && params[1] === denied ? "deny" : "allow",
            },
        ]);
        const update = jest.spyOn(RoomServiceClient.prototype, "updateParticipant").mockResolvedValue({});
        const response = await request(createApp())
            .patch("/api/v1/channels/10/speakers/5")
            .set("Authorization", authorization)
            .send({ speaking: true });
        expect(response.status).toBe(404);
        expect(update).not.toHaveBeenCalled();
    });
    it("empêche un gestionnaire de changer les droits vocaux du propriétaire", async () => {
        const authorization = access("stage", manager);
        on("guilds.findById", () => ({ guildId: 7, ownerId: 5 }));
        const update = jest.spyOn(RoomServiceClient.prototype, "updateParticipant").mockResolvedValue({});
        const response = await request(createApp())
            .patch("/api/v1/channels/10/speakers/5")
            .set("Authorization", authorization)
            .send({ speaking: false });
        expect(response.status).toBe(403);
        expect(update).not.toHaveBeenCalled();
    });
    it.each([
        { failure: { status: 404 }, expected: 404 },
        { failure: { code: "not_found" }, expected: 404 },
        { failure: { code: "ECONNRESET" }, expected: 503 },
    ])("ne confirme pas une modification de scène refusée par le serveur média : %p", async ({ failure, expected }) => {
        const authorization = access("stage", manager);
        jest.spyOn(RoomServiceClient.prototype, "updateParticipant").mockRejectedValue(failure);
        const persist = jest.fn(() => ({ affectedRows: 1 }));
        on("stage.permission", persist);
        realtime.__reset();
        const response = await request(createApp())
            .patch("/api/v1/channels/10/speakers/5")
            .set("Authorization", authorization)
            .send({ speaking: true });
        expect(response.status).toBe(expected);
        expect(persist).not.toHaveBeenCalled();
        expect(realtime.__emissions.find((entry) => entry.event === "media:permissions")).toBeUndefined();
    });
    it("ne révèle pas un sondage privé via l’adresse d’un autre salon", async () => {
        const authorization = access("poll");
        on("polls.findByMessage", () => ({ pollId: 2, messageId: "800", channelId: 90 }));
        const response = await request(createApp())
            .get("/api/v1/channels/10/polls/800")
            .set("Authorization", authorization);
        expect(response.status).toBe(404);
        expect(response.body.error.message).toBe("Sondage introuvable.");
    });
    it("ne laisse pas créer un sondage pour contourner les annonces", async () => {
        const authorization = access("announcement");
        on("access.channelPermission", (params) => [
            { ownerId: 99, baseEffect: params[1] === "MANAGE_MESSAGES" ? "deny" : "allow", targetType: null },
        ]);
        const response = await request(createApp())
            .post("/api/v1/channels/10/polls")
            .set("Authorization", authorization)
            .send({ question: "Question", options: ["Oui", "Non"] });
        expect(response.status).toBe(403);
    });
    it("ne laisse pas un sujet textuel contourner les droits d’annonce", async () => {
        const authorization = access("announcement");
        on("access.channelPermission", (params) => [
            { ownerId: 99, baseEffect: params[1] === "MANAGE_MESSAGES" ? "deny" : "allow", targetType: null },
        ]);
        const response = await request(createApp())
            .post("/api/v1/channels/10/topics")
            .set("Authorization", authorization)
            .send({ title: "Question", content: "Texte" });
        expect(response.status).toBe(403);
    });
    it.each(["text", "voice", "ticket", "poll"])("refuse les événements dans un salon %s", async (type) => {
        const authorization = access(type);
        const response = await request(createApp())
            .post("/api/v1/channels/10/events")
            .set("Authorization", authorization)
            .send({ title: "Réunion", startsAt: new Date(Date.now() + 3600000).toISOString() });
        expect(response.status).toBe(400);
    });
    it("ferme les écritures d’un salon temporaire tout en conservant le contexte", async () => {
        const authorization = access("ephemeral", member, { expiresAt: new Date(Date.now() - 1000) });
        const write = await request(createApp())
            .post("/api/v1/channels/10/messages")
            .set("Authorization", authorization)
            .send({ content: "Trop tard" });
        expect(write.status).toBe(403);
        expect(write.body.error.message).toMatch(/temporaire.*fermé/);
        const read = await request(createApp()).get("/api/v1/channels/10/context").set("Authorization", authorization);
        expect(read.status).toBe(200);
        expect(read.body.expired).toBe(true);
        expect(read.body.writable).toBe(false);
    });
    it("permet au gestionnaire de prolonger un salon temporaire fermé", async () => {
        const authorization = access("ephemeral", manager, { expiresAt: new Date(Date.now() - 1000) });
        let stored;
        on("channels.update", (params) => {
            stored = params;
            return { affectedRows: 1 };
        });
        const expiresAt = new Date(Date.now() + 3600000).toISOString();
        const response = await request(createApp())
            .patch("/api/v1/channels/10")
            .set("Authorization", authorization)
            .send({ expiresAt });
        expect(response.status).toBe(200);
        expect(stored[0]).toEqual(new Date(expiresAt));
    });
    it("ignore les automatisations visant un salon fermé sans arrêter les autres règles", async () => {
        const automationService = require("../../src/services/automationService");
        const messageService = require("../../src/services/messageService");
        const taskService = require("../../src/services/taskService");
        const post = jest.spyOn(messageService, "postMessage").mockResolvedValue({});
        const createTask = jest.spyOn(taskService, "create").mockResolvedValue({});
        on("automations.active", () => [
            { channelId: 20, action: "post_message", template: "Message" },
            { channelId: 20, action: "create_task", template: "Tâche" },
            { channelId: 30, action: "post_message", template: "Message ouvert" },
        ]);
        on("channels.findById", ([id]) =>
            id === 20
                ? channel("ephemeral", { channelId: 20, expiresAt: new Date(Date.now() - 1000) })
                : channel("text", { channelId: 30 })
        );

        await automationService.dispatch(channel("text"), member, "message.created", {});

        expect(post.mock.calls.map(([target]) => target.channelId)).toEqual([30]);
        expect(createTask).not.toHaveBeenCalled();
    });
    it("refuse aussi la publication d’un bot dans un salon temporaire fermé", async () => {
        const token = "bot-expiry-fixture";
        on("bots.findByPublicId", () => ({
            botId: 1,
            guildId: 7,
            name: "Test",
            createdBy: 5,
            tokenHash: require("node:crypto").createHash("sha256").update(token).digest("hex"),
        }));
        on("channels.findById", () => channel("ephemeral", { expiresAt: new Date(Date.now() - 1000) }));
        on("bots.touch", () => ({ affectedRows: 1 }));
        let written = false;
        on("messages.createFromBot", () => {
            written = true;
            return { affectedRows: 1 };
        });
        on("messages.findById", () => ({
            messageId: "900",
            channelId: 10,
            content: "Après fermeture",
            userId: 5,
            handle: "camille",
            displayName: "Camille",
            createdAt: new Date(),
        }));

        const response = await request(createApp())
            .post("/api/v1/bots/testbot01/messages")
            .set("Authorization", `Bot ${token}`)
            .send({ channelId: 10, content: "Après fermeture" });

        expect(response.status).toBe(403);
        expect(response.body.error.message).toMatch(/temporaire.*fermé/);
        expect(written).toBe(false);
    });
    it("demande le nom exact avant la suppression d’un salon", async () => {
        const authorization = access("text", manager);
        const response = await request(createApp())
            .delete("/api/v1/channels/10")
            .set("Authorization", authorization)
            .send({ confirm: "autre" });
        expect(response.status).toBe(400);
    });
    it("réserve la décision d’accès aux gestionnaires", async () => {
        const authorization = access("gated");
        const response = await request(createApp())
            .patch("/api/v1/channels/10/access/8")
            .set("Authorization", authorization)
            .send({ status: "approved" });
        expect(response.status).toBe(403);
    });
    it("refuse une demande d’accès pour un non-membre", async () => {
        const authorization = access("gated");
        on("access.guildRole", () => null);
        const response = await request(createApp())
            .get("/api/v1/channels/10/access")
            .set("Authorization", authorization);
        expect(response.status).toBe(404);
    });
    it("valide l’accès d’un membre et prévient les clients du changement de droits", async () => {
        const authorization = access("gated", manager);
        on("roles.memberExists", () => ({ found: 1 }));
        on("channelAccess.target", () => ({ status: "pending" }));
        on("channelAccess.decide", () => ({ affectedRows: 1 }));
        let permission;
        on("channelAccess.permission", (params) => {
            permission = params;
            return { affectedRows: 1 };
        });
        on("channelAccess.own", () => null);
        on("channelAccess.list", () => []);
        realtime.__reset();
        const response = await request(createApp())
            .patch("/api/v1/channels/10/access/5")
            .set("Authorization", authorization)
            .send({ status: "approved" });
        expect(response.status).toBe(200);
        expect(permission).toEqual([10, 5, "allow"]);
        expect(realtime.__emissions.some((entry) => entry.event === "channel:permissions")).toBe(true);
    });
    it.each([null, channel("text"), channel("gated", { guildId: null })])(
        "ne dévoile pas un accès sur demande pour un salon incompatible : %p",
        async (stored) => {
            const authorization = access("gated");
            on("channels.findById", () => stored);
            const response = await request(createApp())
                .get("/api/v1/channels/10/access")
                .set("Authorization", authorization);
            expect(response.status).toBe(404);
        }
    );
    it("ne livre à un membre que sa propre demande, sans celles des autres", async () => {
        const authorization = access("gated");
        on("access.channelPermission", () => [{ ownerId: 99, baseEffect: "deny" }]);
        on("channelAccess.own", () => ({ status: "pending", reason: "Rejoindre le projet" }));
        const list = jest.fn(() => [{ userId: 99, reason: "Demande confidentielle" }]);
        on("channelAccess.list", list);
        const response = await request(createApp())
            .get("/api/v1/channels/10/access")
            .set("Authorization", authorization);
        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({
            allowed: false,
            canReview: false,
            request: { status: "pending", reason: "Rejoindre le projet" },
            requests: [],
        });
        expect(list).not.toHaveBeenCalled();
    });
    it("notifie une demande d’accès sans diffuser son motif à toute la communauté", async () => {
        const authorization = access("gated");
        on("access.channelPermission", () => [{ ownerId: 99, baseEffect: "deny" }]);
        const save = jest.fn(() => ({ affectedRows: 1 }));
        on("channelAccess.request", save);
        on("channelAccess.own", () => ({ status: "pending", reason: "Motif personnel" }));
        realtime.__reset();
        const response = await request(createApp())
            .post("/api/v1/channels/10/access")
            .set("Authorization", authorization)
            .send({ reason: "Motif personnel" });
        expect(response.status).toBe(200);
        expect(save.mock.calls[0][0]).toEqual([10, 5, "Motif personnel"]);
        expect(response.body.request.status).toBe("pending");
        const notification = realtime.__emissions.find((entry) => entry.event === "channel:access");
        expect(notification.payload).toEqual({ channelId: 10, guildId: 7 });
    });
    it("ne recrée pas de demande pour un membre déjà autorisé", async () => {
        const authorization = access("gated");
        on("channelAccess.own", () => ({ status: "approved" }));
        const save = jest.fn(() => ({ affectedRows: 1 }));
        on("channelAccess.request", save);
        realtime.__reset();
        const response = await request(createApp())
            .post("/api/v1/channels/10/access")
            .set("Authorization", authorization)
            .send({ reason: "Nouvelle demande inutile" });
        expect(response.status).toBe(200);
        expect(response.body.allowed).toBe(true);
        expect(save).not.toHaveBeenCalled();
        expect(realtime.__emissions.find((entry) => entry.event === "channel:access")).toBeUndefined();
    });
    it.each(["request", "review"])(
        "bloque une opération d’accès sur une communauté suspendue : %s",
        async (operation) => {
            const authorization = access("gated", operation === "review" ? manager : member);
            on("guilds.findById", () => ({ guildId: 7, ownerId: 8, suspendedAt: new Date() }));
            const mutate = jest.fn(() => ({ affectedRows: 1 }));
            on("channelAccess.request", mutate);
            on("channelAccess.decide", mutate);
            const app = request(createApp());
            const call =
                operation === "review"
                    ? app.patch("/api/v1/channels/10/access/5").send({ status: "approved" })
                    : app.post("/api/v1/channels/10/access").send({ reason: "Rejoindre" });
            const response = await call.set("Authorization", authorization);
            expect(response.status).toBe(403);
            expect(mutate).not.toHaveBeenCalled();
        }
    );
    it.each([
        { exists: false, pending: null, status: 404 },
        { exists: true, pending: null, status: 400 },
    ])("refuse une décision sans membre ou sans demande : %p", async ({ exists, pending, status }) => {
        const authorization = access("gated", manager);
        on("roles.memberExists", () => (exists ? { found: 1 } : null));
        on("channelAccess.target", () => pending);
        const mutate = jest.fn(() => ({ affectedRows: 1 }));
        on("channelAccess.permission", mutate);
        const response = await request(createApp())
            .patch("/api/v1/channels/10/access/5")
            .set("Authorization", authorization)
            .send({ status: "approved" });
        expect(response.status).toBe(status);
        expect(mutate).not.toHaveBeenCalled();
    });
    it("révoque l’accès et retire seulement les sockets devenues non autorisées", async () => {
        const authorization = access("gated", manager);
        on("roles.memberExists", () => ({ found: 1 }));
        on("channelAccess.target", () => ({ status: "approved" }));
        on("channelAccess.decide", () => ({ affectedRows: 1 }));
        const permission = jest.fn(() => ({ affectedRows: 1 }));
        on("channelAccess.permission", permission);
        on("channelAccess.own", () => null);
        on("channelAccess.list", () => [{ userId: "5", status: "declined" }]);
        on("access.resolveChannel", (params) => (params[0] === 5 ? null : channel("gated")));
        const excluded = { data: { userId: 5 }, leave: jest.fn() };
        const retained = { data: { userId: 8 }, leave: jest.fn() };
        jest.spyOn(realtime, "getIo").mockReturnValue({
            in: () => ({ fetchSockets: async () => [excluded, retained] }),
        });
        const response = await request(createApp())
            .patch("/api/v1/channels/10/access/5")
            .set("Authorization", authorization)
            .send({ status: "declined" });
        expect(response.status).toBe(200);
        expect(permission.mock.calls[0][0]).toEqual([10, 5, "deny"]);
        expect(excluded.leave).toHaveBeenCalledWith("channel:10");
        expect(retained.leave).not.toHaveBeenCalled();
        expect(response.body.requests).toEqual([{ userId: 5, status: "declined" }]);
    });
    it("ne présente pas des tickets comme chiffrés de bout en bout", async () => {
        const authorization = access("ticket", manager);
        const response = await request(createApp())
            .patch("/api/v1/channels/10/e2ee")
            .set("Authorization", authorization)
            .send({ enabled: true });
        expect(response.status).toBe(400);
        expect(response.body.error.message).toMatch(/contenus structurés/);
    });
});
