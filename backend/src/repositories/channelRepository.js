"use strict";

const { query, queryOne } = require("../db/pool");

const channelRepository = {
    update: (channelId, fields, connection) => {
        const entries = Object.entries(fields);
        return query(
            "channels.update",
            `UPDATE channels SET ${entries.map(([key]) => `${key} = ?`).join(", ")} WHERE channelId = ?`,
            [...entries.map(([, value]) => value), channelId],
            connection
        );
    },
    remove: (channelId, connection) =>
        query("channels.remove", "DELETE FROM channels WHERE channelId = ?", [channelId], connection),
    restrictDefault: (channelId, guildId, connection) =>
        query(
            "channels.restrictDefault",
            `INSERT INTO channel_permission_overrides (channelId, targetType, targetId, permission, effect)
         SELECT ?, 'role', roleId, 'VIEW_CHANNEL', 'deny' FROM guild_roles WHERE guildId = ? AND isDefault = 1
         ON DUPLICATE KEY UPDATE effect = 'deny'`,
            [channelId, guildId],
            connection
        ),
    restrictStage: (channelId, guildId, connection) =>
        query(
            "channels.restrictStage",
            `INSERT IGNORE INTO channel_permission_overrides (channelId, targetType, targetId, permission, effect)
         SELECT ?, 'role', r.roleId, p.permission, 'deny' FROM guild_roles r
         CROSS JOIN (SELECT 'SPEAK' permission UNION ALL SELECT 'VIDEO' UNION ALL SELECT 'STREAM') p
         WHERE r.guildId = ? AND r.isDefault = 1`,
            [channelId, guildId],
            connection
        ),
    findById: (channelId, connection) =>
        queryOne("channels.findById", "SELECT * FROM channels WHERE channelId = ?", [channelId], connection),

    createGuildChannel: async (data, connection) => {
        const result = await query(
            "channels.createGuild",
            "INSERT INTO channels (type, name, description, guildId, categoryId, position) VALUES (?, ?, ?, ?, ?, ?)",
            [data.type, data.name, data.description, data.guildId, data.categoryId ?? null, data.position ?? 0],
            connection
        );
        return channelRepository.findById(result.insertId, connection);
    },

    createDirectChannel: async (friendshipId, connection) => {
        const result = await query(
            "channels.createDirect",
            "INSERT INTO channels (type, name, description, friendshipId) VALUES ('text', 'direct', '', ?)",
            [friendshipId],
            connection
        );
        return channelRepository.findById(result.insertId, connection);
    },

    setPlacement: (channelId, guildId, { categoryId, position }, connection) =>
        query(
            "channels.setPlacement",
            "UPDATE channels SET categoryId = ?, position = ? WHERE channelId = ? AND guildId = ?",
            [categoryId, position, channelId, guildId],
            connection
        ),

    listByGuild: (guildId, connection) =>
        query(
            "channels.listByGuild",
            "SELECT * FROM channels WHERE guildId = ? ORDER BY position ASC, channelId ASC",
            [guildId],
            connection
        ),

    firstByGuild: (guildId, connection) =>
        queryOne(
            "channels.firstByGuild",
            "SELECT * FROM channels WHERE guildId = ? ORDER BY position ASC, channelId ASC LIMIT 1",
            [guildId],
            connection
        ),

    listDirectForUser: (userId, connection) =>
        query(
            "channels.listDirectForUser",
            `SELECT c.channelId, c.type, c.e2eeEnabled,
                    COALESCE(NULLIF(u.displayName, ''), u.handle) AS name,
                    u.userId, u.handle, u.displayName, u.avatar, u.bannerImage,
                    u.aboutMe, u.activityText, u.statusPreference, u.presence
             FROM channels c
             JOIN friendships f ON f.friendshipId = c.friendshipId
             JOIN users u ON u.userId = CASE WHEN f.requesterId = ? THEN f.addresseeId ELSE f.requesterId END
             WHERE c.friendshipId IS NOT NULL
               AND (f.requesterId = ? OR f.addresseeId = ?)
               AND f.status = 'accepted'
             ORDER BY u.displayName ASC`,
            [userId, userId, userId],
            connection
        ),
};

module.exports = channelRepository;
