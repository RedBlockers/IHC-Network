const db = require("./connDB");
const logger = require("../utils/logger");

module.exports = {
    getChannelsByGuild: async (guild) => {
        const startTime = Date.now();
        const [rows] = await db
            .promise()
            .execute("SELECT * FROM channels WHERE guildId = ?", [
                guild.guildId,
            ]);
        const channels = [];
        rows.forEach((row) => {
            const channel = {
                channelId: row.channelId,
                type: row.type,
                name: row.name,
                description: row.description,
                guild: guild,
            };
            channels.push(channel);
        });
        logger.debug({
            event: "DBQuery",
            operation: "SELECT",
            table: "channels",
            querySummary: `SELECT * FROM channels WHERE guildId = ${guild.guildId}`,
            duration: Date.now() - startTime,
            success: true,
        });
        return channels;
    },
    getChannelById: async (id, guild) => {
        const startTime = Date.now();
        const [rows] = await db
            .promise()
            .execute("SELECT * FROM channels WHERE channelId = ? LIMIT 1", [
                id,
            ]);
        if (rows.length === 0) {
            logger.info(`Aucun channel trouvé avec l'ID ${id}`);
            return null;
        }
        const row = rows[0];
        const channel = {
            channelId: row.channelId,
            type: row.type,
            name: row.name,
            description: row.description,
            guild: guild,
        };
        logger.debug({
            event: "DBQuery",
            operation: "SELECT",
            table: "channels",
            querySummary: `SELECT * FROM channels WHERE channelId = ${id}`,
            duration: Date.now() - startTime,
            success: true,
        });
        return channel;
    },
    getFirstChannelByGuild: async (guild) => {
        const startTime = Date.now();
        const [rows] = await db
            .promise()
            .execute("SELECT * FROM channels WHERE guildId = ? LIMIT 1", [
                guild.guildId,
            ]);
        const row = rows[0];
        const channel = {
            channelId: row.channelId,
            type: row.type,
            name: row.name,
            description: row.description,
            guild: guild,
        };
        logger.debug({
            event: "DBQuery",
            operation: "SELECT",
            table: "channels",
            querySummary: `SELECT * FROM channels WHERE guildId = ${guild.guildId} LIMIT 1`,
            duration: Date.now() - startTime,
            success: true,
        });
        return channel;
    },
    createChannel: async (type, name, description, guildId) => {
        const startTime = Date.now();
        try {
            const [result] = await db
                .promise()
                .execute(
                    "INSERT INTO channels (type, name, description, guildId, isPrivate) VALUES (?, ?, ?, ?, 1)",
                    [type, name, description, guildId]
                );
            logger.debug({
                event: "DBQuery",
                operation: "INSERT",
                table: "channels",
                querySummary: `INSERT INTO channels (type, name, description, guildId) VALUES (?, ?, ?, ?)`,
                parameters: [type, name, description, guildId],
                duration: Date.now() - startTime,
                success: true,
            });
            return result.insertId;
        } catch (err) {
            logger.error({
                event: "DBError",
                message: error.message,
                stack: error.stack,
                duration: `${Date.now() - startTime}ms`,
            });
            throw err;
        }
    },
    getPrivateChannelsByUserId: async (userId) => {
        const startTime = Date.now();
        const [rows] = await db
            .promise()
            .execute(
                "SELECT u.userNickname, u.userId, u.userImage, c.* FROM users as u INNER JOIN friends as f ON (f.friendId = u.userId AND f.userId = ?) OR (f.userId = u.userId AND f.friendId = ?) INNER JOIN channels as c ON f.id = c.friendId ",
                [userId, userId]
            );
        const channels = [];
        rows.forEach((row) => {
            const channel = {
                channelId: row.channelId,
                type: row.type,
                name: row.userNickname,
                description: row.description,
                user: {
                    userId: row.userId,
                    username: row.userNickname,
                    userImage: row.userImage,
                },
            };
            channels.push(channel);
        });
        logger.debug({
            event: "DBQuery",
            operation: "SELECT",
            table: "channels",
            querySummary: `SELECT u.userNickname, u.userId, u.userImage, c.* FROM users as u INNER JOIN friends as f ON (f.friendId = u.userId AND f.userId = ?) OR (f.userId = u.userId AND f.friendId = ?) INNER JOIN channels as c ON f.id = c.friendId`,
            parameters: [userId, userId],
            duration: Date.now() - startTime,
            success: true,
        });
        return channels;
    },
};
