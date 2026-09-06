"use strict";

const { query, queryOne, withTransaction } = require("../db/pool");
const channelRepository = require("../repositories/channelRepository");
const roleRepository = require("../repositories/roleRepository");
const guildRepository = require("../repositories/guildRepository");
const accessService = require("./accessService");
const realtime = require("../realtime");
const { BadRequest, Forbidden, NotFound } = require("../errors");

async function resolve(channelId, user) {
    const channel = await channelRepository.findById(channelId);
    if (
        !channel ||
        channel.type !== "gated" ||
        !channel.guildId ||
        !(await accessService.guildRole(user.userId, channel.guildId))
    ) {
        throw new NotFound("Salon introuvable.");
    }
    return channel;
}

async function overview(channelId, user) {
    const channel = await resolve(channelId, user);
    const [allowed, canReview, own] = await Promise.all([
        accessService.hasChannelPermission(user.userId, channelId, "VIEW_CHANNEL", channel),
        accessService.hasGuildPermission(user.userId, channel.guildId, "MANAGE_CHANNELS"),
        queryOne(
            "channelAccess.own",
            "SELECT status, reason, updatedAt FROM channel_access_requests WHERE channelId = ? AND userId = ?",
            [channelId, user.userId]
        ),
    ]);
    const requests = canReview
        ? await query(
              "channelAccess.list",
              `SELECT r.userId, r.status, r.reason, r.createdAt, r.updatedAt, u.handle, u.displayName, u.avatar
         FROM channel_access_requests r JOIN users u ON u.userId = r.userId
         JOIN guild_members gm ON gm.guildId = ? AND gm.userId = r.userId
         WHERE r.channelId = ? ORDER BY FIELD(r.status, 'pending', 'approved', 'declined'), r.updatedAt DESC`,
              [channel.guildId, channelId]
          )
        : [];
    return {
        channelId: Number(channelId),
        allowed,
        canReview,
        request: own,
        requests: requests.map((request) => ({ ...request, userId: Number(request.userId) })),
    };
}

async function request(channelId, user, reason) {
    const channel = await resolve(channelId, user);
    const guild = await guildRepository.findById(channel.guildId);
    if (guild?.suspendedAt) throw new Forbidden("Cette communauté est suspendue.");
    if (await accessService.hasChannelPermission(user.userId, channelId, "VIEW_CHANNEL", channel))
        return overview(channelId, user);
    await query(
        "channelAccess.request",
        `INSERT INTO channel_access_requests (channelId, userId, reason) VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE status = IF(status = 'declined', 'pending', status), reason = IF(status <> 'approved', VALUES(reason), reason)`,
        [channelId, user.userId, reason]
    );
    realtime.emitToGuild(Number(channel.guildId), "channel:access", {
        channelId: Number(channelId),
        guildId: Number(channel.guildId),
    });
    return overview(channelId, user);
}

async function decide(channelId, user, targetId, status) {
    const channel = await resolve(channelId, user);
    const guild = await guildRepository.findById(channel.guildId);
    if (guild?.suspendedAt) throw new Forbidden("Cette communauté est suspendue.");
    if (!(await accessService.hasGuildPermission(user.userId, channel.guildId, "MANAGE_CHANNELS")))
        throw new Forbidden("Seule l’équipe qui gère les salons peut décider d’un accès.");
    if (!(await roleRepository.memberExists(channel.guildId, targetId))) throw new NotFound("Membre introuvable.");
    const existing = await queryOne(
        "channelAccess.target",
        "SELECT status FROM channel_access_requests WHERE channelId = ? AND userId = ?",
        [channelId, targetId]
    );
    if (!existing) throw new BadRequest("Cette personne n’a pas demandé d’accès.");
    await withTransaction(async (connection) => {
        await query(
            "channelAccess.decide",
            "UPDATE channel_access_requests SET status = ?, reviewedBy = ? WHERE channelId = ? AND userId = ?",
            [status, user.userId, channelId, targetId],
            connection
        );
        await query(
            "channelAccess.permission",
            `INSERT INTO channel_permission_overrides (channelId, targetType, targetId, permission, effect)
            VALUES (?, 'member', ?, 'VIEW_CHANNEL', ?) ON DUPLICATE KEY UPDATE effect = VALUES(effect)`,
            [channelId, targetId, status === "approved" ? "allow" : "deny"],
            connection
        );
    });
    await refreshAccess(channelId, channel.guildId);
    return overview(channelId, user);
}

async function refreshAccess(channelId, guildId) {
    const io = realtime.getIo();
    if (io) {
        const sockets = await io.in(realtime.channelRoom(channelId)).fetchSockets();
        await Promise.all(
            sockets.map(async (socket) => {
                if (!(await accessService.canAccessChannel(socket.data.userId, channelId)))
                    await socket.leave(realtime.channelRoom(channelId));
            })
        );
    }
    realtime.emitToGuild(Number(guildId), "channel:permissions", {
        channelId: Number(channelId),
        guildId: Number(guildId),
    });
}

module.exports = { overview, request, decide, refreshAccess };
