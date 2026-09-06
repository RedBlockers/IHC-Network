"use strict";

const { query, queryOne } = require("../db/pool");

const SELECT_NOTIFICATION = `
    SELECT n.notificationId, n.type, n.channelId, CAST(n.messageId AS CHAR) AS messageId,
           n.readAt, n.createdAt, n.actorId,
           actor.handle AS actorHandle, actor.displayName AS actorDisplayName, actor.avatar AS actorAvatar,
           c.name AS channelName, c.guildId, g.name AS guildName
    FROM notifications n
    LEFT JOIN users actor ON actor.userId = n.actorId
    LEFT JOIN channels c ON c.channelId = n.channelId
    LEFT JOIN guilds g ON g.guildId = c.guildId
`;

const FILTER_CLAUSES = {
    all: "",
    mentions: "AND n.type IN ('mention','reply')",
    threads: "AND n.type = 'thread'",
};

const clauseFor = (filter) => FILTER_CLAUSES[filter] ?? FILTER_CLAUSES.all;

const notificationRepository = {
    create: async ({ userId, actorId, type, channelId, messageId }, connection) => {
        const result = await query(
            "notifications.create",
            `INSERT IGNORE INTO notifications (userId, actorId, type, channelId, messageId)
             VALUES (?, ?, ?, ?, ?)`,
            [userId, actorId, type, channelId ?? null, messageId ?? null],
            connection
        );
        return result.affectedRows > 0 ? Number(result.insertId) : null;
    },

    findByIdForUser: (notificationId, userId, connection) =>
        queryOne(
            "notifications.findByIdForUser",
            `${SELECT_NOTIFICATION} WHERE n.notificationId = ? AND n.userId = ?`,
            [notificationId, userId],
            connection
        ),

    listForUser: (userId, limit = 30, { filter = "all", before = null } = {}, connection) => {
        const params = [userId];
        if (before) params.push(before);
        return query(
            "notifications.listForUser",
            `${SELECT_NOTIFICATION}
             WHERE n.userId = ? ${clauseFor(filter)}
             ${before ? "AND n.notificationId < ?" : ""}
             ORDER BY n.notificationId DESC
             LIMIT ${Math.min(Math.max(limit, 1), 100) + 1}`,
            params,
            connection
        );
    },

    countUnread: (userId, connection) =>
        queryOne(
            "notifications.countUnread",
            `SELECT
                 COUNT(*) AS total,
                 SUM(n.type IN ('mention','reply')) AS mentions,
                 SUM(n.type = 'thread') AS threads
             FROM notifications n
             WHERE n.userId = ? AND n.readAt IS NULL`,
            [userId],
            connection
        ),

    digestSince: (userId, since, connection) =>
        query(
            "notifications.digestSince",
            `SELECT c.channelId, c.name AS channelName, c.guildId, g.name AS guildName,
                    COUNT(*) AS total,
                    SUM(n.type IN ('mention','reply')) AS mentions,
                    MAX(n.createdAt) AS lastAt
             FROM notifications n
             LEFT JOIN channels c ON c.channelId = n.channelId
             LEFT JOIN guilds g ON g.guildId = c.guildId
             WHERE n.userId = ? AND n.readAt IS NULL AND n.createdAt >= ?
             GROUP BY c.channelId, c.name, c.guildId, g.name
             ORDER BY mentions DESC, total DESC`,
            [userId, since],
            connection
        ),

    markRead: (notificationId, userId, connection) =>
        query(
            "notifications.markRead",
            "UPDATE notifications SET readAt = COALESCE(readAt, NOW(3)) WHERE notificationId = ? AND userId = ?",
            [notificationId, userId],
            connection
        ),

    markAllRead: (userId, filter = "all", connection) =>
        query(
            "notifications.markAllRead",
            `UPDATE notifications n
             SET n.readAt = NOW(3)
             WHERE n.userId = ? AND n.readAt IS NULL ${clauseFor(filter)}`,
            [userId],
            connection
        ),
};

module.exports = notificationRepository;
