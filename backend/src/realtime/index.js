"use strict";

const { Server } = require("socket.io");
const { createAdapter } = require("@socket.io/redis-adapter");

const config = require("../config");
const { logger, serializeError } = require("../logger");
const redis = require("../infra/redis");
const metrics = require("../infra/metrics");
const tokenService = require("../services/tokenService");
const cacheService = require("../services/cacheService");
const presenceService = require("../services/presenceService");
const friendshipRepository = require("../repositories/friendshipRepository");
const guildRepository = require("../repositories/guildRepository");
const { canAccessChannel, hasGuildRole } = require("../services/accessService");
const { consumeEventBudget, canEmitTyping } = require("./eventGuard");

const userRoom = (userId) => `user:${userId}`;
const channelRoom = (channelId) => `channel:${channelId}`;
const guildRoom = (guildId) => `guild:${guildId}`;

let io = null;
let heartbeatTimer = null;

function init(httpServer) {
    io = new Server(httpServer, {
        cors: { origin: config.CORS_ORIGIN, methods: ["GET", "POST"] },
        allowRequest: (req, callback) => {
            const origin = req.headers.origin;
            callback(null, !origin || config.CORS_ORIGIN.includes(origin));
        },
        connectionStateRecovery: { maxDisconnectionDuration: 2 * 60_000 },
    });

    const adapterClients = redis.getAdapterClients();
    if (adapterClients) {
        io.adapter(createAdapter(adapterClients.pubClient, adapterClients.subClient));
        logger.info("adaptateur Socket.IO Redis actif");
    } else {
        logger.warn("Socket.IO en mode mono-nœud (pas d'adaptateur Redis)");
    }

    io.use(async (socket, next) => {
        try {
            const payload = tokenService.verify(socket.handshake.auth?.token);
            const user = await cacheService.getUserById(payload.userId);
            if (!user || !tokenService.matchesUser(payload, user)) return next(new Error("unauthorized"));
            Object.assign(socket.data, {
                userId: Number(user.userId),
                displayName: user.displayName,
                statusPreference: user.statusPreference ?? "online",
            });
            next();
        } catch {
            next(new Error("unauthorized"));
        }
    });

    io.on("connection", (socket) => onConnection(socket));

    heartbeatTimer = setInterval(() => {
        const userIds = new Set();
        for (const [, socket] of io.of("/").sockets) userIds.add(socket.data.userId);
        for (const userId of userIds) presenceService.heartbeat(userId).catch(() => {});
    }, (config.PRESENCE_TTL_SECONDS / 2) * 1000);
    heartbeatTimer.unref();

    logger.info("Socket.IO initialisé");
    return io;
}

async function onConnection(socket) {
    const userId = socket.data.userId;
    socket.join(userRoom(userId));
    metrics.socketsConnected.inc();

    try {
        const cameOnline = await presenceService.connect(userId);
        if (cameOnline) await broadcastPresence(userId, effectivePresence(socket.data.statusPreference, true));
    } catch (error) {
        logger.error("échec d'entrée en présence", { userId, error: serializeError(error) });
    }

    socket.on("channel:subscribe", async (channelId, ack) => {
        try {
            if (!consumeEventBudget(socket, "subscribe", 30, 10_000)) {
                return respond(ack, { ok: false, error: "rate_limited" });
            }
            const id = Number(channelId);
            if (!Number.isInteger(id) || id <= 0) return respond(ack, { ok: false, error: "bad_request" });
            if (!(await canAccessChannel(userId, id))) return respond(ack, { ok: false, error: "forbidden" });
            socket.join(channelRoom(id));
            respond(ack, { ok: true });
        } catch (error) {
            logger.error("échec d'abonnement au salon", { userId, error: serializeError(error) });
            respond(ack, { ok: false, error: "internal_error" });
        }
    });

    socket.on("channel:unsubscribe", (channelId) => {
        const id = Number(channelId);
        if (Number.isInteger(id) && id > 0) socket.leave(channelRoom(id));
    });

    socket.on("typing:start", (channelId) => {
        const id = Number(channelId);
        if (canEmitTyping(socket, id)) {
            socket.to(channelRoom(id)).emit("typing:start", {
                channelId: id,
                userId,
                displayName: socket.data.displayName,
            });
        }
    });

    socket.on("guild:subscribe", async (guildId, ack) => {
        try {
            if (!consumeEventBudget(socket, "subscribe", 30, 10_000)) {
                return respond(ack, { ok: false, error: "rate_limited" });
            }
            const id = Number(guildId);
            if (!Number.isInteger(id) || id <= 0) return respond(ack, { ok: false, error: "bad_request" });
            if (!(await hasGuildRole(userId, id, "member"))) return respond(ack, { ok: false, error: "forbidden" });
            socket.join(guildRoom(id));
            respond(ack, { ok: true });
        } catch (error) {
            logger.error("échec d'abonnement à la guilde", { userId, error: serializeError(error) });
            respond(ack, { ok: false, error: "internal_error" });
        }
    });

    socket.on("guild:unsubscribe", (guildId) => {
        const id = Number(guildId);
        if (Number.isInteger(id) && id > 0) socket.leave(guildRoom(id));
    });

    socket.on("disconnect", async () => {
        metrics.socketsConnected.dec();
        try {
            const wentOffline = await presenceService.disconnect(userId);
            if (wentOffline) await broadcastPresence(userId, "offline");
        } catch (error) {
            logger.error("échec de sortie de présence", { userId, error: serializeError(error) });
        }
    });
}

async function broadcastPresence(userId, status) {
    const [friendships, guilds] = await Promise.all([
        friendshipRepository.listForUser(userId),
        guildRepository.listIdsForUser(userId),
    ]);
    for (const row of friendships) {
        if (row.status !== "accepted") continue;
        emitToUser(Number(row.userId), "presence:update", { userId, status });
    }
    for (const row of guilds) emitToGuild(Number(row.guildId), "presence:update", { userId, status });
}

const effectivePresence = (preference, online) => {
    if (!online || preference === "invisible") return "offline";
    return ["online", "idle", "dnd"].includes(preference) ? preference : "online";
};

const respond = (ack, payload) => {
    if (typeof ack === "function") ack(payload);
};

function emitToChannel(channelId, event, payload) {
    io?.to(channelRoom(channelId)).emit(event, payload);
}

function emitToGuild(guildId, event, payload) {
    io?.to(guildRoom(guildId)).emit(event, payload);
}

function emitToUser(userId, event, payload) {
    io?.to(userRoom(userId)).emit(event, payload);
}

function getIo() {
    return io;
}

async function close() {
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    if (io) await new Promise((resolve) => io.close(resolve));
}

module.exports = { init, emitToChannel, emitToGuild, emitToUser, getIo, close, userRoom, channelRoom, guildRoom };
