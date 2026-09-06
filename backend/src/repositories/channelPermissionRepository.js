"use strict";

const { query } = require("../db/pool");

const channelPermissionRepository = {
    list: (channelId, connection) => query(
        "channelPermissions.list",
        `SELECT permission_override.channelId, permission_override.targetType, permission_override.targetId,
                permission_override.permission, permission_override.effect,
                CASE WHEN permission_override.targetType = 'role' THEN role.name ELSE user.displayName END AS targetName,
                CASE WHEN permission_override.targetType = 'role' THEN role.iconEmoji ELSE user.avatar END AS targetIcon,
                CASE WHEN permission_override.targetType = 'role' THEN role.color ELSE NULL END AS targetColor
         FROM channel_permission_overrides permission_override
         LEFT JOIN guild_roles role
                ON permission_override.targetType = 'role' AND role.roleId = permission_override.targetId
         LEFT JOIN users user
                ON permission_override.targetType = 'member' AND user.userId = permission_override.targetId
         WHERE permission_override.channelId = ?
         ORDER BY permission_override.targetType DESC, targetName ASC, permission_override.permission ASC`,
        [channelId],
        connection
    ),

    clearTarget: (channelId, targetType, targetId, connection) => query(
        "channelPermissions.clearTarget",
        "DELETE FROM channel_permission_overrides WHERE channelId = ? AND targetType = ? AND targetId = ?",
        [channelId, targetType, targetId],
        connection
    ),

    set: (channelId, targetType, targetId, permission, effect, connection) => query(
        "channelPermissions.set",
        `INSERT INTO channel_permission_overrides (channelId, targetType, targetId, permission, effect)
         VALUES (?, ?, ?, ?, ?)`,
        [channelId, targetType, targetId, permission, effect],
        connection
    ),
};

module.exports = channelPermissionRepository;
