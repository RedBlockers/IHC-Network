"use strict";

const { query, queryOne } = require("../db/pool");

const MEMBER_SORTS = {
    joined: "m.joinedAt DESC, u.userId DESC",
    oldest: "m.joinedAt ASC, u.userId ASC",
    name: "COALESCE(NULLIF(u.displayName, ''), u.handle) ASC, u.userId ASC",
};

const guildRepository = {
    searchMembers: (
        guildId,
        { search = "", roleId = null, sort = "joined", limit = 40, offset = 0 } = {},
        connection
    ) => {
        const params = [guildId];
        let where = "WHERE m.guildId = ?";

        if (search) {
            where += " AND (u.handle LIKE ? OR u.displayName LIKE ?)";
            params.push(`%${search}%`, `%${search}%`);
        }
        if (roleId) {
            where +=
                " AND EXISTS (SELECT 1 FROM guild_member_roles mr WHERE mr.guildId = m.guildId AND mr.userId = m.userId AND mr.roleId = ?)";
            params.push(roleId);
        }

        return query(
            "guilds.searchMembers",
            `SELECT u.userId, u.handle, u.displayName, u.avatar, u.isBot, u.createdAt AS accountCreatedAt,
                    m.role, m.joinedAt,
                    COALESCE((
                        SELECT JSON_ARRAYAGG(JSON_OBJECT(
                            'roleId', r.roleId, 'name', r.name, 'iconEmoji', r.iconEmoji,
                            'color', r.color, 'position', r.position, 'isDefault', r.isDefault
                        ))
                        FROM guild_member_roles mr JOIN guild_roles r ON r.roleId = mr.roleId
                        WHERE mr.guildId = m.guildId AND mr.userId = m.userId
                    ), JSON_ARRAY()) AS roles
             FROM guild_members m
             JOIN users u ON u.userId = m.userId
             ${where}
             ORDER BY m.role = 'owner' DESC, ${MEMBER_SORTS[sort] ?? MEMBER_SORTS.joined}
             LIMIT ${Math.min(Math.max(limit, 1), 100) + 1} OFFSET ${Math.max(offset, 0)}`,
            params,
            connection
        );
    },

    countSanctions: (guildId, connection) =>
        queryOne(
            "guilds.countSanctions",
            `SELECT
                 SUM(s.type = 'ban') AS bans,
                 SUM(s.type = 'timeout') AS timeouts,
                 SUM(s.issuedAt >= NOW() - INTERVAL 7 DAY) AS lastWeek
             FROM guild_sanctions s
             WHERE s.guildId = ?
               AND s.revokedAt IS NULL
               AND (s.expiresAt IS NULL OR s.expiresAt > NOW())`,
            [guildId],
            connection
        ),

    countOpenReports: (guildId, connection) =>
        queryOne(
            "guilds.countOpenReports",
            `SELECT COUNT(*) AS open,
                    MIN(r.createdAt) AS oldestAt
             FROM message_reports r
             WHERE r.guildId = ? AND r.status = 'open'`,
            [guildId],
            connection
        ),

    countActivity: (guildId, sinceMessageId, connection) =>
        queryOne(
            "guilds.countActivity",
            `SELECT COUNT(*) AS messagesWeek,
                    COUNT(DISTINCT msg.userId) AS activeAuthors
             FROM messages msg
             JOIN channels c ON c.channelId = msg.channelId
             WHERE c.guildId = ? AND msg.messageId >= ?`,
            [guildId, sinceMessageId],
            connection
        ),

    countHealth: (guildId, sinceMessageId, connection) =>
        queryOne(
            "guilds.countHealth",
            `SELECT
                 (SELECT COUNT(*) FROM guild_members WHERE guildId = ?) AS members,
                 (SELECT COUNT(*) FROM guild_onboarding_completions WHERE guildId = ?) AS onboarded,
                 (SELECT COUNT(*) FROM guild_members m
                   WHERE m.guildId = ? AND m.joinedAt < NOW() - INTERVAL 7 DAY
                     AND EXISTS (
                         SELECT 1 FROM messages msg
                         JOIN channels c ON c.channelId = msg.channelId
                         WHERE c.guildId = m.guildId AND msg.userId = m.userId
                           AND msg.messageId >= ?
                     )) AS retained,
                 (SELECT COUNT(*) FROM guild_members
                   WHERE guildId = ? AND joinedAt < NOW() - INTERVAL 7 DAY) AS eligible,
                 (SELECT COUNT(*) FROM guild_sanctions
                   WHERE guildId = ? AND issuedAt >= NOW() - INTERVAL 30 DAY) AS sanctionsMonth`,
            [guildId, guildId, guildId, sinceMessageId, guildId, guildId],
            connection
        ),

    exportMessages: (guildId, afterId, limit, connection) =>
        query(
            "guilds.exportMessages",
            `SELECT CAST(m.messageId AS CHAR) AS messageId, m.channelId, m.content, m.createdAt, m.editedAt,
                    m.webhookName, u.handle AS authorHandle, c.name AS channelName
             FROM messages m
             JOIN channels c ON c.channelId = m.channelId
             JOIN users u ON u.userId = m.userId
             WHERE c.guildId = ? AND m.messageId > ?
             ORDER BY m.messageId ASC
             LIMIT ${Math.min(Math.max(limit, 1), 5000)}`,
            [guildId, afterId],
            connection
        ),

    setSuspension: (guildId, { suspendedAt, reason, by }, connection) =>
        query(
            "guilds.setSuspension",
            "UPDATE guilds SET suspendedAt = ?, suspendedReason = ?, suspendedBy = ? WHERE guildId = ?",
            [suspendedAt, reason, by, guildId],
            connection
        ),

    countStructure: (guildId, connection) =>
        queryOne(
            "guilds.countStructure",
            `SELECT
                 (SELECT COUNT(*) FROM channels WHERE guildId = ?) AS channels,
                 (SELECT COUNT(*) FROM guild_roles WHERE guildId = ?) AS roles,
                 (SELECT COUNT(*) FROM invites WHERE guildId = ?) AS invites`,
            [guildId, guildId, guildId],
            connection
        ),

    listDiscoverable: (search, limit, connection) => {
        const params = [];
        let where = "WHERE g.isDiscoverable = 1";
        if (search) {
            where += " AND (g.name LIKE ? OR g.discoveryPitch LIKE ? OR g.discoveryTags LIKE ?)";
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }
        return query(
            "guilds.listDiscoverable",
            `SELECT g.guildId, g.name, g.icon, g.banner, g.accent, g.discoveryPitch, g.discoveryTags,
                    (SELECT COUNT(*) FROM guild_members m WHERE m.guildId = g.guildId) AS members
             FROM guilds g
             ${where}
             ORDER BY members DESC, g.guildId DESC
             LIMIT ${Math.min(Math.max(limit, 1), 50)}`,
            params,
            connection
        );
    },

    setDiscovery: (guildId, { isDiscoverable, pitch, tags }, connection) =>
        query(
            "guilds.setDiscovery",
            "UPDATE guilds SET isDiscoverable = ?, discoveryPitch = ?, discoveryTags = ? WHERE guildId = ?",
            [isDiscoverable ? 1 : 0, pitch ?? null, tags ?? null, guildId],
            connection
        ),

    setOwner: (guildId, userId, connection) =>
        query("guilds.setOwner", "UPDATE guilds SET ownerId = ? WHERE guildId = ?", [userId, guildId], connection),

    setMemberRole: (guildId, userId, role, connection) =>
        query(
            "guilds.setMemberRole",
            "UPDATE guild_members SET role = ? WHERE guildId = ? AND userId = ?",
            [role, guildId, userId],
            connection
        ),

    delete: (guildId, connection) =>
        query("guilds.delete", "DELETE FROM guilds WHERE guildId = ?", [guildId], connection),

    countMembers: (guildId, connection) =>
        queryOne(
            "guilds.countMembers",
            `SELECT COUNT(*) AS total,
                    SUM(m.joinedAt >= NOW() - INTERVAL 7 DAY) AS joinedWeek,
                    SUM(m.joinedAt >= NOW() - INTERVAL 30 DAY) AS joinedMonth,
                    SUM(u.isBot = 1) AS bots
             FROM guild_members m
             JOIN users u ON u.userId = m.userId
             WHERE m.guildId = ?`,
            [guildId],
            connection
        ),

    findById: (guildId, connection) =>
        queryOne("guilds.findById", "SELECT * FROM guilds WHERE guildId = ?", [guildId], connection),

    create: async (data, connection) => {
        const result = await query(
            "guilds.create",
            "INSERT INTO guilds (name, description, icon, banner, accent, ownerId) VALUES (?, ?, ?, ?, ?, ?)",
            [data.name, data.description, data.icon, data.banner ?? null, data.accent ?? null, data.ownerId],
            connection
        );
        return guildRepository.findById(result.insertId, connection);
    },

    update: async (guildId, fields, connection) => {
        const ALLOWED = [
            "name",
            "description",
            "icon",
            "banner",
            "bannerImage",
            "bannerFocusX",
            "bannerFocusY",
            "accent",
        ];
        const entries = Object.entries(fields).filter(([key]) => ALLOWED.includes(key));
        if (entries.length === 0) return false;
        const setClause = entries.map(([key]) => `${key} = ?`).join(", ");
        const values = entries.map(([, value]) => value);
        const result = await query(
            "guilds.update",
            `UPDATE guilds SET ${setClause} WHERE guildId = ?`,
            [...values, guildId],
            connection
        );
        return result.affectedRows > 0;
    },

    addMember: (guildId, userId, role, connection) =>
        query(
            "guilds.addMember",
            "INSERT IGNORE INTO guild_members (guildId, userId, role) VALUES (?, ?, ?)",
            [guildId, userId, role],
            connection
        ),

    removeMember: async (guildId, userId, connection) => {
        const result = await query(
            "guilds.removeMember",
            "DELETE FROM guild_members WHERE guildId = ? AND userId = ? AND role <> 'owner'",
            [guildId, userId],
            connection
        );
        return result.affectedRows > 0;
    },

    getMembership: (guildId, userId, connection) =>
        queryOne(
            "guilds.getMembership",
            "SELECT role FROM guild_members WHERE guildId = ? AND userId = ?",
            [guildId, userId],
            connection
        ),

    listForUser: (userId, connection) =>
        query(
            "guilds.listForUser",
            `SELECT g.* FROM guilds g
             JOIN guild_members m ON m.guildId = g.guildId
             WHERE m.userId = ?
             ORDER BY g.name ASC`,
            [userId],
            connection
        ),

    listIdsForUser: (userId, connection) =>
        query("guilds.listIdsForUser", "SELECT guildId FROM guild_members WHERE userId = ?", [userId], connection),

    countOwnedByUser: (userId) =>
        queryOne("guilds.countOwnedByUser", "SELECT COUNT(*) AS total FROM guilds WHERE ownerId = ?", [userId]),
};

module.exports = guildRepository;
