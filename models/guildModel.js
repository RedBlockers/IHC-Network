const db = require("./connDB");
const logger = require("../utils/logger");

module.exports = {
    getGuilds: async () => {
        const startTime = Date.now();
        const [rows] = await db.promise().execute("SELECT * FROM guilds_user");
        const guilds = [];
        rows.forEach((row) => {
            const guild = {
                guildId: row.guildId,
                guildName: row.guildName,
                guildImage: row.guildImage,
                guildDescription: row.guildDescription,
                ownerId: row.userId,
            };
            guilds.push(guild);
        });
        logger.debug({
            event: "DBQuery",
            operation: "SELECT",
            table: "guilds_user",
            querySummary: "SELECT * FROM guilds_user",
            duration: Date.now() - startTime,
            success: true,
        });
        return guilds;
    },
    getGuildsByUser: async (userId) => {
        const startTime = Date.now();
        const [rows] = await db
            .promise()
            .execute("SELECT * FROM guilds_user WHERE userId = ?", [userId]);
        const guilds = [];
        rows.forEach((row) => {
            const guild = {
                guildId: row.guildId,
                guildName: row.guildName,
                guildImage: row.guildImage,
                guildDescription: row.guildDescription,
                ownerId: row.userId,
            };
            guilds.push(guild);
        });
        logger.debug({
            event: "DBQuery",
            operation: "SELECT",
            table: "guilds_user",
            querySummary: `SELECT * FROM guilds_user WHERE userId = ${userId}`,
            duration: Date.now() - startTime,
            success: true,
        });
        return guilds;
    },

    getGuildById: async (guildId) => {
        const startTime = Date.now();
        const [rows] = await db
            .promise()
            .execute("SELECT * FROM guilds WHERE guildId = ?", [guildId]);
        const guilds = [];
        rows.forEach((row) => {
            const guild = {
                guildId: row.guildId,
                guildName: row.guildName,
                guildImage: row.guildImage,
                guildDescription: row.guildDescription,
                ownerId: row.userId,
            };
            guilds.push(guild);
        });
        logger.debug({
            event: "DBQuery",
            operation: "SELECT",
            table: "guilds",
            querySummary: `SELECT * FROM guilds WHERE guildId = ${guildId}`,
            duration: Date.now() - startTime,
            success: true,
        });
        return guilds[0];
    },

    createGuild: async (guildName, guildImage, guildDescription, ownerId) => {
        const startTime = Date.now();
        logger.info("Creating new guild");
        try {
            const [result] = await db
                .promise()
                .execute(
                    "INSERT INTO guilds (guildName, guildImage, guildDescription, ownerId) " +
                        "VALUES (?, ?, ?, ?)",
                    [guildName, guildImage, guildDescription, ownerId]
                );
            logger.info("Created guild");
            logger.debug({
                event: "DBQuery",
                operation: "INSERT",
                table: "guilds",
                querySummary:
                    "INSERT INTO guilds (guildName, guildImage, guildDescription, ownerId) VALUES (?, ?, ?, ?)",
                parameters: [guildName, guildImage, guildDescription, ownerId],
                duration: Date.now() - startTime,
                success: true,
            });
            return result;
        } catch (err) {
            logger.error({
                event: "DBError",
                message: error.message,
                stack: error.stack,
                duration: `${Date.now() - startTime}ms`,
            });
            logger.error(err);
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
            logger.debug({
                event: "DBQuery",
                operation: "INSERT",
                table: "invites",
                querySummary:
                    "INSERT INTO invites (guild, author, invite) VALUES (?, ?, ?)",
                parameters: [guildId, userId, invite],
                duration: Date.now() - startTime,
                success: true,
            });
            return result;
        } catch (err) {
            logger.error({
                event: "DBError",
                message: err.message,
                stack: err.stack,
                duration: `${Date.now() - startTime}ms`,
            });
        }
    },

    getGuildByInviteCode: async (inviteCode) => {
        const startTime = Date.now();
        try {
            const [rows] = await db
                .promise()
                .execute("SELECT * FROM invites WHERE invite = ?", [
                    inviteCode,
                ]);
            const invites = [];
            rows.forEach((row) => {
                const invite = {
                    id: row.id,
                    guildId: row.guild,
                    authorId: row.author,
                };
                invites.push(invite);
            });
            logger.debug({
                event: "DBQuery",
                operation: "SELECT",
                table: "invites",
                querySummary: `SELECT * FROM invites WHERE invite = ${inviteCode}`,
                duration: Date.now() - startTime,
                success: true,
            });
            return invites[0];
        } catch (err) {
            logger.error({
                event: "DBError",
                message: err.message,
                stack: err.stack,
                duration: `${Date.now() - startTime}ms`,
            });
            return null;
        }
    },
};
