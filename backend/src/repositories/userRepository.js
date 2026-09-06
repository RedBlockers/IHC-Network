"use strict";

const { query, queryOne, withTransaction } = require("../db/pool");

const PUBLIC_COLUMNS =
    "userId, handle, displayName, email, avatar, bannerImage, aboutMe, activityText, presence, statusPreference, isBot, isEmailVerified, isBanned, bannedUntil, passwordUpdatedAt, createdAt, " +
    "themePreference, densityPreference, accentPreference, reduceMotion, highContrast, hideBanners, neutralizeCommunityThemes, bannerBehaviour, " +
    "deletionRequestedAt, policyVersion, policyAcceptedAt, suspensionReason";

const PREFERENCE_COLUMNS = {
    theme: "themePreference",
    density: "densityPreference",
    accent: "accentPreference",
    reduceMotion: "reduceMotion",
    highContrast: "highContrast",
    hideBanners: "hideBanners",
    neutralizeCommunityThemes: "neutralizeCommunityThemes",
    bannerBehaviour: "bannerBehaviour",
};

const userRepository = {
    findById: (userId, connection) =>
        queryOne("users.findById", `SELECT ${PUBLIC_COLUMNS} FROM users WHERE userId = ?`, [userId], connection),

    findByHandle: (handle, connection) =>
        queryOne("users.findByHandle", `SELECT ${PUBLIC_COLUMNS} FROM users WHERE handle = ?`, [handle], connection),

    searchByHandle: (prefix, excludedUserId, connection) =>
        query(
            "users.searchByHandle",
            `SELECT userId, handle, displayName, avatar, bannerImage, aboutMe, activityText, presence, statusPreference, isBot
             FROM users
             WHERE userId <> ? AND handle LIKE ?
             ORDER BY handle = ? DESC, handle ASC
             LIMIT 10`,
            [excludedUserId, `${prefix}%`, prefix],
            connection
        ),

    findByIdentifierWithSecret: (identifier, connection) =>
        queryOne(
            "users.findByIdentifierWithSecret",
            `SELECT ${PUBLIC_COLUMNS}, password FROM users WHERE handle = ? OR email = ? LIMIT 1`,
            [identifier, String(identifier).toLowerCase()],
            connection
        ),

    findByHandleWithSecret: (handle, connection) =>
        queryOne(
            "users.findByHandleWithSecret",
            `SELECT ${PUBLIC_COLUMNS}, password FROM users WHERE handle = ?`,
            [handle],
            connection
        ),

    existsByHandle: async (handle, connection) => {
        const row = await queryOne(
            "users.existsByHandle",
            "SELECT 1 AS ok FROM users WHERE handle = ?",
            [handle],
            connection
        );
        return row !== null;
    },

    findByEmail: (email, connection) =>
        queryOne("users.findByEmail", `SELECT ${PUBLIC_COLUMNS} FROM users WHERE email = ?`, [email], connection),

    markEmailVerified: (userId, connection) =>
        query("users.markEmailVerified", "UPDATE users SET isEmailVerified = 1 WHERE userId = ?", [userId], connection),

    existsByEmail: async (email, connection) => {
        const row = await queryOne(
            "users.existsByEmail",
            "SELECT 1 AS ok FROM users WHERE email = ?",
            [email],
            connection
        );
        return row !== null;
    },

    create: async (data, connection) => {
        const result = await query(
            "users.create",
            `INSERT INTO users (handle, displayName, email, password, avatar, aboutMe)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [data.handle, data.displayName, data.email, data.password, data.avatar, data.aboutMe],
            connection
        );
        return userRepository.findById(result.insertId, connection);
    },

    updateAvatar: (userId, avatar, connection) =>
        query("users.updateAvatar", "UPDATE users SET avatar = ? WHERE userId = ?", [avatar, userId], connection),

    updatePasswordHash: (userId, password, connection) =>
        query(
            "users.updatePasswordHash",
            "UPDATE users SET password = ? WHERE userId = ?",
            [password, userId],
            connection
        ),

    updateProfile: async (userId, fields, connection) => {
        const allowed = [
            "handle",
            "displayName",
            "avatar",
            "avatarDecoration",
            "bannerImage",
            "aboutMe",
            "activityText",
            "statusPreference",
        ];
        const entries = Object.entries(fields).filter(([key]) => allowed.includes(key));
        if (entries.length === 0) return false;
        const result = await query(
            "users.updateProfile",
            `UPDATE users SET ${entries.map(([key]) => `${key} = ?`).join(", ")} WHERE userId = ?`,
            [...entries.map(([, value]) => value), userId],
            connection
        );
        return result.affectedRows > 0;
    },

    updatePreferences: async (userId, preferences, connection) => {
        const entries = Object.entries(preferences)
            .filter(([key]) => Object.hasOwn(PREFERENCE_COLUMNS, key))
            .map(([key, value]) => [PREFERENCE_COLUMNS[key], typeof value === "boolean" ? Number(value) : value]);
        if (entries.length === 0) return false;
        const result = await query(
            "users.updatePreferences",
            `UPDATE users SET ${entries.map(([column]) => `${column} = ?`).join(", ")} WHERE userId = ?`,
            [...entries.map(([, value]) => value), userId],
            connection
        );
        return result.affectedRows > 0;
    },

    requestDeletion: (userId, connection) =>
        query(
            "users.requestDeletion",
            "UPDATE users SET deletionRequestedAt = NOW() WHERE userId = ? AND deletionRequestedAt IS NULL",
            [userId],
            connection
        ),

    cancelDeletion: (userId, connection) =>
        query(
            "users.cancelDeletion",
            "UPDATE users SET deletionRequestedAt = NULL WHERE userId = ?",
            [userId],
            connection
        ),

    hardDelete: (userId) =>
        withTransaction(async (connection) => {
            await query(
                "users.clearFriendships",
                "DELETE FROM friendships WHERE requesterId = ? OR addresseeId = ?",
                [userId, userId],
                connection
            );
            return query("users.hardDelete", "DELETE FROM users WHERE userId = ?", [userId], connection);
        }),

    findDueDeletions: () =>
        query(
            "users.findDueDeletions",
            "SELECT userId, deletionRequestedAt FROM users WHERE deletionRequestedAt <= DATE_SUB(NOW(), INTERVAL 30 DAY) ORDER BY deletionRequestedAt LIMIT 100",
            []
        ),

    acceptPolicy: (userId, version, connection) =>
        query(
            "users.acceptPolicy",
            "UPDATE users SET policyVersion = ?, policyAcceptedAt = NOW() WHERE userId = ?",
            [version, userId],
            connection
        ),

    listByGuild: async (guildId, connection) => {
        const rows = await query(
            "users.listByGuild",
            `SELECT u.userId, u.handle, u.displayName, u.avatar, u.avatarDecoration, u.bannerImage, u.aboutMe, u.activityText,
                    u.presence, u.statusPreference, u.isBot, m.role,
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
             WHERE m.guildId = ?
             ORDER BY m.role = 'owner' DESC, u.displayName ASC`,
            [guildId],
            connection
        );
        return rows;
    },
};

module.exports = userRepository;
