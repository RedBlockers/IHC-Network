"use strict";

const { queryOne } = require("../db/pool");
const { query } = require("../db/pool");
const { PERMISSIONS } = require("../domain/permissions");

async function findChannelAccess(userId, channelId) {
    return queryOne(
        "access.resolveChannel",
        `SELECT c.channelId, c.type, c.name, c.description, c.guildId, c.friendshipId,
                c.isGroup, c.groupOwnerId, c.position, c.expiresAt,
                c.e2eeEnabled,
                g.suspendedAt, g.suspendedReason,
                c.customModeId, m.name AS modeName, m.baseType AS modeBaseType,
                m.acceptsMessages AS modeAcceptsMessages, m.requiresThread AS modeRequiresThread,
                m.requiresPoll AS modeRequiresPoll, m.requiresAttachment AS modeRequiresAttachment,
                m.pinnedFirst AS modePinnedFirst, m.refusal AS modeRefusal
         FROM channels c
         LEFT JOIN guilds g ON g.guildId = c.guildId
         LEFT JOIN guild_channel_modes m ON m.modeId = c.customModeId
         LEFT JOIN guild_members gm
                ON gm.guildId = c.guildId AND gm.userId = ?
         LEFT JOIN friendships f
                ON f.friendshipId = c.friendshipId
               AND f.status = 'accepted'
               AND (f.requesterId = ? OR f.addresseeId = ?)
         LEFT JOIN channel_participants p
                ON p.channelId = c.channelId AND p.userId = ?
         WHERE c.channelId = ?
           AND (gm.userId IS NOT NULL OR f.friendshipId IS NOT NULL OR p.userId IS NOT NULL)`,
        [userId, userId, userId, userId, channelId]
    );
}

const customModeOf = (row) =>
    row.customModeId
        ? {
              modeId: Number(row.customModeId),
              name: row.modeName,
              baseType: row.modeBaseType,
              acceptsMessages: row.modeAcceptsMessages,
              requiresThread: row.modeRequiresThread,
              requiresPoll: row.modeRequiresPoll,
              requiresAttachment: row.modeRequiresAttachment,
              pinnedFirst: row.modePinnedFirst,
              refusal: row.modeRefusal,
          }
        : null;

async function resolveChannelAccess(userId, channelId) {
    const row = await findChannelAccess(userId, channelId);
    if (!row) return null;
    row.customMode = customModeOf(row);
    if (row.guildId && !(await hasChannelPermission(userId, channelId, "VIEW_CHANNEL", row))) return null;
    return { channel: row };
}

async function canAccessChannel(userId, channelId) {
    const access = await resolveChannelAccess(userId, channelId);
    return access !== null;
}

async function guildRole(userId, guildId) {
    const row = await queryOne("access.guildRole", "SELECT role FROM guild_members WHERE guildId = ? AND userId = ?", [
        guildId,
        userId,
    ]);
    return row?.role ?? null;
}

const ROLE_RANK = { member: 0, admin: 1, owner: 2 };

async function hasGuildRole(userId, guildId, minimumRole) {
    const role = await guildRole(userId, guildId);
    if (!role) return false;
    return ROLE_RANK[role] >= ROLE_RANK[minimumRole];
}

async function hasGuildPermission(userId, guildId, permission) {
    const rows = await query(
        "access.guildPermission",
        `SELECT g.ownerId, rp.effect
         FROM guilds g
         JOIN guild_members gm ON gm.guildId = g.guildId AND gm.userId = ?
         LEFT JOIN guild_member_roles mr ON mr.guildId = gm.guildId AND mr.userId = gm.userId
         LEFT JOIN guild_role_permissions rp ON rp.roleId = mr.roleId AND rp.permission = ?
         WHERE g.guildId = ?`,
        [userId, permission, guildId]
    );
    if (rows.length === 0) return false;
    if (Number(rows[0].ownerId) === Number(userId)) return true;
    if (rows.some((row) => row.effect === "deny")) return false;
    return rows.some((row) => row.effect === "allow");
}

function resolveEffect(rows, targetType, field) {
    const effects = rows
        .filter((row) => targetType === null || row.targetType === targetType)
        .map((row) => row[field])
        .filter(Boolean);
    if (effects.includes("deny")) return false;
    if (effects.includes("allow")) return true;
    return null;
}

async function hasChannelPermission(userId, channelId, permission, knownChannel = null) {
    const channel = knownChannel ?? (await findChannelAccess(userId, channelId));
    if (!channel) return false;
    if (!channel.guildId) return true;

    const rows = await channelPermissionRows(userId, channelId, permission);
    if (rows.length === 0) return false;
    if (Number(rows[0].ownerId) === Number(userId)) return true;

    const memberEffect = resolveEffect(rows, "member", "overrideEffect");
    if (memberEffect !== null) return memberEffect;
    const roleEffect = resolveEffect(rows, "role", "overrideEffect");
    if (roleEffect !== null) return roleEffect;
    return resolveEffect(rows, null, "baseEffect") === true;
}

async function channelPermissionRows(userId, channelId, permission) {
    return query(
        "access.channelPermission",
        `SELECT g.ownerId,
                (SELECT CASE
                    WHEN SUM(rp.effect = 'deny') > 0 THEN 'deny'
                    WHEN SUM(rp.effect = 'allow') > 0 THEN 'allow'
                    ELSE NULL
                 END
                 FROM guild_member_roles base_mr
                 JOIN guild_role_permissions rp ON rp.roleId = base_mr.roleId
                 WHERE base_mr.guildId = c.guildId
                   AND base_mr.userId = ctx.userId
                   AND rp.permission = ctx.permission) AS baseEffect,
                permission_override.targetType,
                permission_override.effect AS overrideEffect
         FROM (SELECT ? AS userId, ? AS permission, ? AS channelId) ctx
         JOIN channels c ON c.channelId = ctx.channelId
         JOIN guilds g ON g.guildId = c.guildId
         JOIN guild_members gm ON gm.guildId = c.guildId AND gm.userId = ctx.userId
         LEFT JOIN channel_permission_overrides permission_override
                ON permission_override.channelId = c.channelId
               AND permission_override.permission = ctx.permission
               AND (
                    (permission_override.targetType = 'member' AND permission_override.targetId = ctx.userId)
                    OR
                    (permission_override.targetType = 'role' AND EXISTS (
                        SELECT 1 FROM guild_member_roles override_mr
                        WHERE override_mr.guildId = c.guildId
                          AND override_mr.userId = ctx.userId
                          AND override_mr.roleId = permission_override.targetId
                    ))
               )`,
        [userId, permission, channelId]
    );
}

const REASONS = {
    owner: "Propriétaire de la communauté : toutes les permissions.",
    "member-allow": "Autorisation posée sur cette personne dans ce salon.",
    "member-deny": "Refus posé sur cette personne dans ce salon.",
    "role-allow": "Autorisation posée sur l'un de ses rôles dans ce salon.",
    "role-deny": "Refus posé sur l'un de ses rôles dans ce salon.",
    "base-allow": "Accordée par l'un de ses rôles dans la communauté.",
    "base-deny": "Refusée par l'un de ses rôles dans la communauté.",
    default: "Aucune règle ne l'accorde : refus par défaut.",
};

async function explainChannelPermission(userId, channelId, permission, knownChannel = null) {
    const channel = knownChannel ?? (await findChannelAccess(userId, channelId));
    if (!channel) return { allowed: false, source: "no-access", reason: "Ce salon ne lui est pas accessible." };
    if (!channel.guildId) {
        return {
            allowed: true,
            source: "direct",
            reason: "Conversation privée : les permissions de salon ne s'y appliquent pas.",
        };
    }

    const rows = await channelPermissionRows(userId, channelId, permission);
    if (rows.length === 0) {
        return { allowed: false, source: "not-member", reason: "Cette personne n'est pas membre de la communauté." };
    }
    if (Number(rows[0].ownerId) === Number(userId)) {
        return { allowed: true, source: "owner", reason: REASONS.owner };
    }

    const member = resolveEffect(rows, "member", "overrideEffect");
    if (member !== null) {
        const source = member ? "member-allow" : "member-deny";
        return { allowed: member, source, reason: REASONS[source] };
    }

    const role = resolveEffect(rows, "role", "overrideEffect");
    if (role !== null) {
        const source = role ? "role-allow" : "role-deny";
        return { allowed: role, source, reason: REASONS[source] };
    }

    const base = resolveEffect(rows, null, "baseEffect");
    if (base === true) return { allowed: true, source: "base-allow", reason: REASONS["base-allow"] };
    if (base === false) return { allowed: false, source: "base-deny", reason: REASONS["base-deny"] };

    return { allowed: false, source: "default", reason: REASONS.default };
}

async function effectiveGuildPermissions(userId, guildId) {
    const rows = await query(
        "access.guildPermissions",
        `SELECT g.ownerId, rp.permission, rp.effect
         FROM guilds g
         JOIN guild_members gm ON gm.guildId = g.guildId AND gm.userId = ?
         LEFT JOIN guild_member_roles mr ON mr.guildId = gm.guildId AND mr.userId = gm.userId
         LEFT JOIN guild_role_permissions rp ON rp.roleId = mr.roleId
         WHERE g.guildId = ?`,
        [userId, guildId]
    );
    if (rows.length === 0) return [];
    if (Number(rows[0].ownerId) === Number(userId)) return [...PERMISSIONS];
    const effects = new Map();
    for (const row of rows) {
        if (!row.permission) continue;
        if (row.effect === "deny" || !effects.has(row.permission)) effects.set(row.permission, row.effect);
    }
    return [...effects].filter(([, effect]) => effect === "allow").map(([permission]) => permission);
}

async function effectiveChannelPermissions(userId, channelId, channel) {
    if (!channel.guildId) return [...PERMISSIONS];
    const rows = await query(
        "access.channelPermissions",
        `SELECT g.ownerId, rp.permission, rp.effect AS baseEffect, NULL AS targetType, NULL AS overrideEffect
         FROM channels c JOIN guilds g ON g.guildId = c.guildId
         JOIN guild_members gm ON gm.guildId = c.guildId AND gm.userId = ?
         LEFT JOIN guild_member_roles mr ON mr.guildId = gm.guildId AND mr.userId = gm.userId
         LEFT JOIN guild_role_permissions rp ON rp.roleId = mr.roleId
         WHERE c.channelId = ?
         UNION ALL
         SELECT g.ownerId, o.permission, NULL AS baseEffect, o.targetType, o.effect AS overrideEffect
         FROM channels c JOIN guilds g ON g.guildId = c.guildId
         JOIN guild_members gm ON gm.guildId = c.guildId AND gm.userId = ?
         JOIN channel_permission_overrides o ON o.channelId = c.channelId AND (
             (o.targetType = 'member' AND o.targetId = gm.userId) OR
             (o.targetType = 'role' AND EXISTS (SELECT 1 FROM guild_member_roles mr
                 WHERE mr.guildId = gm.guildId AND mr.userId = gm.userId AND mr.roleId = o.targetId))
         ) WHERE c.channelId = ?`,
        [userId, channelId, userId, channelId]
    );
    if (!rows.length) return [];
    if (Number(rows[0].ownerId) === Number(userId)) return [...PERMISSIONS];
    return PERMISSIONS.filter((permission) => {
        const relevant = rows.filter((row) => row.permission === permission);
        return (
            (resolveEffect(relevant, "member", "overrideEffect") ??
                resolveEffect(relevant, "role", "overrideEffect") ??
                resolveEffect(relevant, null, "baseEffect")) === true
        );
    });
}

module.exports = {
    resolveChannelAccess,
    canAccessChannel,
    guildRole,
    hasGuildRole,
    hasGuildPermission,
    hasChannelPermission,
    explainChannelPermission,
    effectiveGuildPermissions,
    effectiveChannelPermissions,
    ROLE_RANK,
};
