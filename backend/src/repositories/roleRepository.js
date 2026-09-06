"use strict";

const { query, queryOne } = require("../db/pool");

const roleRepository = {
    initializeGuild: async (guildId, ownerId, connection) => {
        await query(
            "roles.initialize",
            `INSERT INTO guild_roles (guildId, name, iconEmoji, color, position, isDefault, isManaged)
             VALUES (?, '@everyone', NULL, '#8895A5', 0, 1, 1),
                    (?, 'Administration', '🛡️', '#E3B34F', 900, 0, 0),
                    (?, 'Propriétaire', '♛', '#D9A441', 1000, 0, 1)`,
            [guildId, guildId, guildId],
            connection
        );
        await query(
            "roles.initializePermissions",
            `INSERT INTO guild_role_permissions (roleId, permission, effect)
             SELECT gr.roleId, p.permission, 'allow'
             FROM guild_roles gr
             CROSS JOIN (
                 SELECT 'VIEW_CHANNEL' permission UNION ALL SELECT 'SEND_MESSAGES'
                 UNION ALL SELECT 'READ_MESSAGE_HISTORY' UNION ALL SELECT 'ADD_REACTIONS'
                 UNION ALL SELECT 'CREATE_INVITE' UNION ALL SELECT 'CONNECT'
                 UNION ALL SELECT 'SPEAK' UNION ALL SELECT 'VIDEO' UNION ALL SELECT 'STREAM'
             ) p
             WHERE gr.guildId = ? AND gr.isDefault = 1`,
            [guildId],
            connection
        );
        await query(
            "roles.initializeAdminPermissions",
            `INSERT INTO guild_role_permissions (roleId, permission, effect)
             SELECT gr.roleId, p.permission, 'allow'
             FROM guild_roles gr
             CROSS JOIN (
                 SELECT 'VIEW_CHANNEL' permission UNION ALL SELECT 'SEND_MESSAGES'
                 UNION ALL SELECT 'READ_MESSAGE_HISTORY' UNION ALL SELECT 'ADD_REACTIONS'
                 UNION ALL SELECT 'MENTION_EVERYONE' UNION ALL SELECT 'MANAGE_MESSAGES'
                 UNION ALL SELECT 'CREATE_INVITE' UNION ALL SELECT 'CONNECT' UNION ALL SELECT 'SPEAK'
                 UNION ALL SELECT 'VIDEO' UNION ALL SELECT 'STREAM' UNION ALL SELECT 'MUTE_MEMBERS'
                 UNION ALL SELECT 'MOVE_MEMBERS' UNION ALL SELECT 'MANAGE_CHANNELS' UNION ALL SELECT 'MANAGE_ROLES'
                 UNION ALL SELECT 'MANAGE_EMOJIS' UNION ALL SELECT 'MANAGE_WEBHOOKS'
                 UNION ALL SELECT 'MODERATE_MEMBERS' UNION ALL SELECT 'KICK_MEMBERS'
                 UNION ALL SELECT 'BAN_MEMBERS' UNION ALL SELECT 'VIEW_AUDIT_LOG'
             ) p
             WHERE gr.guildId = ? AND gr.name = 'Administration'`,
            [guildId],
            connection
        );
        await roleRepository.assignDefault(guildId, ownerId, connection);
        await query(
            "roles.assignOwner",
            `INSERT INTO guild_member_roles (guildId, userId, roleId)
             SELECT ?, ?, roleId FROM guild_roles WHERE guildId = ? AND name = 'Propriétaire'`,
            [guildId, ownerId, guildId],
            connection
        );
    },

    assignDefault: (guildId, userId, connection) =>
        query(
            "roles.assignDefault",
            `INSERT IGNORE INTO guild_member_roles (guildId, userId, roleId)
             SELECT ?, ?, roleId FROM guild_roles WHERE guildId = ? AND isDefault = 1`,
            [guildId, userId, guildId],
            connection
        ),

    listByGuild: (guildId, connection) =>
        query(
            "roles.listByGuild",
            `SELECT r.roleId, r.guildId, r.name, r.iconEmoji, r.color, r.position,
                    r.isDefault, r.isManaged, r.mentionable, rp.permission, rp.effect,
                    (SELECT COUNT(*) FROM guild_member_roles mr WHERE mr.roleId = r.roleId) AS memberCount
             FROM guild_roles r
             LEFT JOIN guild_role_permissions rp ON rp.roleId = r.roleId
             WHERE r.guildId = ?
             ORDER BY r.position DESC, r.roleId ASC`,
            [guildId],
            connection
        ),

    findById: (guildId, roleId, connection) =>
        queryOne(
            "roles.findById",
            `SELECT roleId, guildId, name, iconEmoji, color, position, isDefault, isManaged, mentionable
             FROM guild_roles WHERE guildId = ? AND roleId = ?`,
            [guildId, roleId],
            connection
        ),

    highestPositionForMember: async (guildId, userId, connection) => {
        const row = await queryOne(
            "roles.highestPositionForMember",
            `SELECT COALESCE(MAX(r.position), 0) AS position
             FROM guild_member_roles mr JOIN guild_roles r ON r.roleId = mr.roleId
             WHERE mr.guildId = ? AND mr.userId = ?`,
            [guildId, userId],
            connection
        );
        return Number(row?.position ?? 0);
    },

    memberExists: async (guildId, userId, connection) =>
        Boolean(await queryOne(
            "roles.memberExists",
            "SELECT 1 AS found FROM guild_members WHERE guildId = ? AND userId = ?",
            [guildId, userId],
            connection
        )),

    create: async (guildId, data, connection) => {
        const result = await query(
            "roles.create",
            `INSERT INTO guild_roles (guildId, name, iconEmoji, color, position, mentionable)
             VALUES (?, ?, ?, ?, COALESCE(?, (SELECT COALESCE(MAX(position), 0) + 1 FROM guild_roles existing WHERE existing.guildId = ?)), ?)`,
            [guildId, data.name, data.iconEmoji ?? null, data.color, data.position ?? null, guildId, data.mentionable ? 1 : 0],
            connection
        );
        return Number(result.insertId);
    },

    setPosition: (guildId, roleId, position, connection) =>
        query(
            "roles.setPosition",
            "UPDATE guild_roles SET position = ? WHERE guildId = ? AND roleId = ? AND isDefault = 0 AND isManaged = 0",
            [position, guildId, roleId],
            connection
        ),

    update: async (guildId, roleId, fields, connection) => {
        const allowed = ["name", "iconEmoji", "color", "position", "mentionable"];
        const entries = Object.entries(fields).filter(([key]) => allowed.includes(key));
        if (entries.length === 0) return false;
        const result = await query(
            "roles.update",
            `UPDATE guild_roles SET ${entries.map(([key]) => `${key} = ?`).join(", ")}
             WHERE guildId = ? AND roleId = ? AND isManaged = 0`,
            [...entries.map(([, value]) => value), guildId, roleId],
            connection
        );
        return result.affectedRows > 0;
    },

    remove: async (guildId, roleId, connection) => {
        const result = await query(
            "roles.remove",
            "DELETE FROM guild_roles WHERE guildId = ? AND roleId = ? AND isManaged = 0 AND isDefault = 0",
            [guildId, roleId],
            connection
        );
        return result.affectedRows > 0;
    },

    clearPermissions: (roleId, connection) =>
        query("roles.clearPermissions", "DELETE FROM guild_role_permissions WHERE roleId = ?", [roleId], connection),

    setPermission: (roleId, permission, effect, connection) =>
        query(
            "roles.setPermission",
            "INSERT INTO guild_role_permissions (roleId, permission, effect) VALUES (?, ?, ?)",
            [roleId, permission, effect],
            connection
        ),

    assign: (guildId, userId, roleId, connection) =>
        query(
            "roles.assign",
            `INSERT IGNORE INTO guild_member_roles (guildId, userId, roleId)
             SELECT ?, ?, roleId FROM guild_roles WHERE guildId = ? AND roleId = ?`,
            [guildId, userId, guildId, roleId],
            connection
        ),

    unassign: (guildId, userId, roleId, connection) =>
        query(
            "roles.unassign",
            `DELETE mr FROM guild_member_roles mr
             JOIN guild_roles r ON r.roleId = mr.roleId
             WHERE mr.guildId = ? AND mr.userId = ? AND mr.roleId = ? AND r.isManaged = 0 AND r.isDefault = 0`,
            [guildId, userId, roleId],
            connection
        ),

    listForMember: (guildId, userId, connection) =>
        query(
            "roles.listForMember",
            `SELECT r.roleId, r.name, r.iconEmoji, r.color, r.position, r.isDefault, r.isManaged, r.mentionable
             FROM guild_member_roles mr JOIN guild_roles r ON r.roleId = mr.roleId
             WHERE mr.guildId = ? AND mr.userId = ? ORDER BY r.position DESC`,
            [guildId, userId],
            connection
        ),
};

module.exports = roleRepository;
