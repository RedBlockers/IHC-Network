"use strict";

const { query, queryOne } = require("../db/pool");

const reportRepository = {
    create: async (data, connection) => {
        const result = await query(
            "reports.create",
            `INSERT INTO message_reports (guildId, channelId, messageId, reporterId, reason)
             VALUES (?, ?, ?, ?, ?)`,
            [data.guildId, data.channelId, data.messageId, data.reporterId, data.reason],
            connection
        );
        return result.insertId;
    },

    findById: (guildId, reportId, connection) =>
        queryOne(
            "reports.findById",
            `SELECT reportId, guildId, channelId, messageId, reporterId, reason, status, resolvedBy, resolvedAt, resolution, createdAt
               FROM message_reports WHERE reportId = ? AND guildId = ?`,
            [reportId, guildId],
            connection
        ),

    listQueue: (guildId, status, limit, connection) =>
        query(
            "reports.listQueue",
            `SELECT r.reportId, r.channelId, r.messageId, r.reason, r.status, r.createdAt, r.resolution,
                    c.name AS channelName,
                    m.content AS messageContent, m.createdAt AS messageCreatedAt,
                    author.userId AS authorId, author.handle AS authorHandle, author.displayName AS authorDisplayName, author.avatar AS authorAvatar,
                    reporter.userId AS reporterId, reporter.handle AS reporterHandle, reporter.displayName AS reporterDisplayName
               FROM message_reports r
               JOIN channels c ON c.channelId = r.channelId
               LEFT JOIN messages m ON m.messageId = r.messageId
               LEFT JOIN users author ON author.userId = m.userId
               JOIN users reporter ON reporter.userId = r.reporterId
              WHERE r.guildId = ? AND r.status = ?
              ORDER BY r.createdAt DESC
              LIMIT ?`,
            [guildId, status, limit],
            connection
        ),

    contextAround: (channelId, messageId, span, connection) =>
        query(
            "reports.contextAround",
            `(SELECT m.messageId, m.content, m.createdAt, u.handle, u.displayName, u.avatar, u.userId
                FROM messages m JOIN users u ON u.userId = m.userId
               WHERE m.channelId = ? AND m.messageId <= ? ORDER BY m.messageId DESC LIMIT ?)
             UNION
             (SELECT m.messageId, m.content, m.createdAt, u.handle, u.displayName, u.avatar, u.userId
                FROM messages m JOIN users u ON u.userId = m.userId
               WHERE m.channelId = ? AND m.messageId > ? ORDER BY m.messageId ASC LIMIT ?)`,
            [channelId, messageId, span, channelId, messageId, span],
            connection
        ),

    resolve: async (guildId, reportId, { status, resolvedBy, resolution }, connection) => {
        const result = await query(
            "reports.resolve",
            `UPDATE message_reports SET status = ?, resolvedBy = ?, resolvedAt = NOW(), resolution = ?
              WHERE reportId = ? AND guildId = ? AND status = 'open'`,
            [status, resolvedBy, resolution, reportId, guildId],
            connection
        );
        return result.affectedRows > 0;
    },

    countOpen: (guildId, connection) =>
        queryOne(
            "reports.countOpen",
            "SELECT COUNT(*) AS total FROM message_reports WHERE guildId = ? AND status = 'open'",
            [guildId],
            connection
        ),
};

module.exports = reportRepository;
