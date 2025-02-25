const db = require("./connDB");
const logger = require("../utils/logger");

module.exports = {
    getGuilds: async () => {
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
        return guilds;
    },
    getGuildsByUser: async (userId) => {
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
        return guilds;
    },

    getGuildById: async (guildId) => {
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
        return guilds[0];
    },

    createGuild: async (guildName, guildImage, guildDescription, ownerId) => {
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
            return result;
        } catch (err) {
            logger.error(err);
        }
    },

    CreateInvite: async (userId, guildId, invite) => {
        logger.info("Creating new invite");
        try {
            const [result] = await db
                .promise()
                .execute(
                    "INSERT INTO invites (guild, author, invite) VALUES (?, ?, ?)",
                    [guildId, userId, invite]
                );
            logger.info("Created invite");
            return result;
        } catch (err) {
            logger.error(err);
        }
    },

    getGuildByInviteCode: async (inviteCode) => {
        logger.info("Getting guild by invite code");
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
            return invites[0];
        } catch (err) {
            logger.error(err.stack);
        }
    },
};
