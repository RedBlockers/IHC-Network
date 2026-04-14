const db = require("./connDB");
const { logDB } = require("../utils/helpers/logHelper");
const { is } = require("zod/locales");

module.exports = {
    doGuildExists: async (guildId) => {
        const startTime = Date.now();
        try {
            const [rows] = await db

                .promise()
                .execute("SELECT * FROM guilds WHERE guildId = ?", [guildId]);

            logDB(
                "SELECT",
                "guilds",
                startTime,
                true,
                `SELECT * FROM guilds WHERE guildId = ${guildId}`
            );
            return rows.length > 0;
        } catch (error) {
            logDB(
                "ERROR",
                "guilds",

                startTime,
                false,
                error.message
            );
            throw error;
        }
    },

    isChannelInGuild: async (guildId, channelId) => {
        const startTime = Date.now();
        try {
            const channel = await db
                .promise()
                .execute(
                    "SELECT * FROM channels WHERE channelId = ? AND guildId = ?",
                    [channelId, guildId]
                );
            logDB(
                "SELECT",
                "channels",
                startTime,
                true,
                `SELECT * FROM channels WHERE channelId = ${channelId} AND guildId = ${guildId}`
            );
            return channel[0].length > 0;
        } catch (error) {
            logDB(
                "SELECT",
                "channels",
                startTime,
                false,
                `SELECT * FROM channels WHERE channelId = ${channelId} AND guildId = ${guildId}`,
                error
            );
            throw error;
        }
    },

    isUserInGuild: async (userId, guildId) => {
        const startTime = Date.now();
        try {
            const [rows] = await db
                .promise()
                .execute(
                    `SELECT * FROM guilds_joined WHERE userId = ? AND guildId = ?`,
                    [userId, guildId]
                );
            logDB(
                "SELECT",
                "guilds_joined",
                startTime,
                true,
                `SELECT * FROM guilds_joined WHERE userId = ${userId} AND guildId = ${guildId}`
            );
            return rows.length > 0;
        } catch (error) {
            logDB(
                "SELECT",
                "guilds_joined",
                startTime,
                false,
                `SELECT * FROM guilds_joined WHERE userId = ${userId} AND guildId = ${guildId}`,
                error
            );
            throw error;
        }
    },

    getGuildsByUser: async (userId) => {
        const startTime = Date.now();
        try {
            const [rows] = await db.promise().execute(
                `
                        -- Liste 1 : Les guildes que je possède
                        SELECT guildId, guildName, guildImage, guildDescription, ownerId
                        FROM guilds
                        WHERE ownerId = ?

                        UNION

                        -- Liste 2 : Les guildes que j'ai rejoint
                        SELECT g.guildId, g.guildName, g.guildImage, g.guildDescription, g.ownerId
                        FROM guilds g
                        JOIN guilds_joined gj ON g.guildId = gj.guildId
                        WHERE gj.userId = ?

                        ORDER BY guildName;
                    `,
                [userId, userId]
            );
            logDB(
                "SELECT",
                "guilds, guilds_joined",
                startTime,
                true,
                ` SELECT guilds owned and joined by user (userId: ${userId})`
            );
            return rows;
        } catch (error) {
            logDB(
                "SELECT",
                "guilds, guilds_joined",
                startTime,
                false,
                ` SELECT guilds owned and joined by user (userId: ${userId})`,
                error
            );
            throw error;
        }
    },

    getGuildById: async (guildId) => {
        const startTime = Date.now();
        try {
            const [rows] = await db
                .promise()
                .execute("SELECT * FROM guilds WHERE guildId = ?", [guildId]);

            logDB(
                "SELECT",
                "guilds",
                startTime,
                true,
                `SELECT * FROM guilds WHERE guildId = ${guildId}`
            );
            return rows[0];
        } catch (error) {
            logDB(
                "SELECT",
                "guilds",
                startTime,
                false,
                `SELECT * FROM guilds WHERE guildId = ${guildId}`,
                error
            );
            throw error;
        }
    },

    getUsersByGuildId: async (guildId) => {
        const startTime = Date.now();
        try {
            const [rows] = await db.promise().execute(
                `SELECT u.userId, u.handle, u.displayName, u.avatar, u.aboutMe, u.notes, u.presence, u.isBot
                    FROM users u
                    JOIN guilds_joined gj ON u.userId = gj.userId
                    WHERE gj.guildId = ?`,
                [guildId]
            );
            logDB(
                "SELECT",
                "users, guilds_joined",
                startTime,
                true,
                `SELECT users in guild (guildId: ${guildId})`
            );
            return rows;
        } catch (error) {
            logDB(
                "SELECT",
                "users, guilds_joined",
                startTime,
                false,
                `SELECT users in guild (guildId: ${guildId})`,
                error
            );
            throw error;
        }
    },

    createGuild: async (guildName, guildImage, guildDescription, ownerId) => {
        const startTime = Date.now();

        try {
            const [result] = await db
                .promise()
                .execute(
                    "INSERT INTO guilds (guildName, guildImage, guildDescription, ownerId) " +
                        "VALUES (?, ?, ?, ?)",
                    [guildName, guildImage, guildDescription, ownerId]
                );
            logDB(
                "INSERT",
                "guilds",
                startTime,
                true,
                "INSERT INTO guilds (guildName, guildImage, guildDescription, ownerId) VALUES (?, ?, ?, ?)",
                [guildName, guildImage, guildDescription, ownerId]
            );

            const [guild] = await db
                .promise()
                .execute("SELECT * FROM guilds WHERE guildId = ?", [
                    result.insertId,
                ]);
            return guild[0];
        } catch (error) {
            logDB(
                "INSERT",
                "guilds",
                startTime,
                false,
                "INSERT INTO guilds (guildName, guildImage, guildDescription, ownerId) VALUES (?, ?, ?, ?)",
                [guildName, guildImage, guildDescription, ownerId],
                error
            );
            throw error;
        }
    },

    CreateInvite: async (userId, guildId, invite) => {
        const startTime = Date.now();
        try {
            const [result] = await db
                .promise()
                .execute(
                    "INSERT INTO invites (guild, author, invite) VALUES (?, ?, ?)",
                    [guildId, userId, invite]
                );
            logDB(
                "INSERT",
                "invites",
                startTime,
                true,
                "INSERT INTO invites (guild, author, invite) VALUES (?, ?, ?)"
            );
            return result;
        } catch (err) {
            logDB(
                "INSERT",
                "invites",
                startTime,
                false,
                "INSERT INTO invites (guild, author, invite) VALUES (?, ?, ?)",
                err
            );
        }
    },

    getInvite: async (inviteCode) => {
        const startTime = Date.now();
        try {
            const [rows] = await db
                .promise()
                .execute("SELECT * FROM invites WHERE invite = ?", [
                    inviteCode,
                ]);
            logDB(
                "SELECT",
                "invites",
                startTime,
                "SELECT * FROM invites WHERE invite = ?",
                true
            );
            const invite = rows[0];
            if (!invite) return null;
            return invite;
        } catch (err) {
            logDB(
                "SELECT",
                "invites",
                startTime,
                "SELECT * FROM invites WHERE invite = ?",
                false,
                err
            );
            return null;
        }
    },
};
