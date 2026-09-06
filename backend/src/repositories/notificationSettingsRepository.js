"use strict";

const { query, queryOne } = require("../db/pool");

const notificationSettingsRepository = {
    listForUser: (userId, connection) =>
        query(
            "notifSettings.listForUser",
            "SELECT scope, targetId, level FROM notification_settings WHERE userId = ? AND level <> 'inherit'",
            [userId],
            connection
        ),

    findForChannel: (userId, guildId, channelId, connection) =>
        query(
            "notifSettings.findForChannel",
            `SELECT scope, targetId, level FROM notification_settings
              WHERE userId = ? AND ((scope = 'guild' AND targetId = ?) OR (scope = 'channel' AND targetId = ?))`,
            [userId, guildId ?? 0, channelId],
            connection
        ),

    upsert: (userId, scope, targetId, level, connection) =>
        query(
            "notifSettings.upsert",
            `INSERT INTO notification_settings (userId, scope, targetId, level) VALUES (?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE level = VALUES(level)`,
            [userId, scope, targetId, level],
            connection
        ),

    findQuietHours: (userId, connection) =>
        queryOne(
            "notifSettings.findQuietHours",
            "SELECT quietHoursStart, quietHoursEnd, desktopNotifications, digestFrequency FROM users WHERE userId = ?",
            [userId],
            connection
        ),

    updateQuietHours: (userId, { start, end, desktop, digest }, connection) =>
        query(
            "notifSettings.updateQuietHours",
            `UPDATE users
             SET quietHoursStart = ?, quietHoursEnd = ?, desktopNotifications = ?, digestFrequency = ?
             WHERE userId = ?`,
            [start, end, desktop ? 1 : 0, digest, userId],
            connection
        ),

    markRead: (userId, channelId, messageId, connection) =>
        query(
            "notifSettings.markRead",
            `INSERT INTO channel_read_state (userId, channelId, lastReadMessageId) VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE lastReadMessageId = GREATEST(lastReadMessageId, VALUES(lastReadMessageId))`,
            [userId, channelId, messageId],
            connection
        ),

    unreadForUser: (userId, channelIds, connection) =>
        query(
            "notifSettings.unreadForUser",
            `SELECT m.channelId, COUNT(*) AS unread
               FROM messages m
               LEFT JOIN channel_read_state r ON r.userId = ? AND r.channelId = m.channelId
              WHERE m.channelId IN (${channelIds.map(() => "?").join(", ")})
                AND m.userId <> ?
                AND m.messageId > COALESCE(r.lastReadMessageId, 0)
              GROUP BY m.channelId`,
            [userId, ...channelIds, userId],
            connection
        ),
};

module.exports = notificationSettingsRepository;
