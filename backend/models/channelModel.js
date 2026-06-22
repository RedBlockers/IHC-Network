const db = require("./connDB");
const { logDB } = require("../utils/helpers/logHelper");
const mappers = require("../utils/mappers");

module.exports = {
    getChannelsByGuildId: async (guildId) => {
        const startTime = Date.now();
        try {
            const [rows] = await db
                .promise()
                .execute("SELECT * FROM channels WHERE guildId = ?", [guildId]);
            logDB(
                "SELECT",
                "channels",
                startTime,
                true,
                `SELECT * FROM channels WHERE guildId = ${guildId}`
            );
            return rows.map((row) =>
                mappers.channelMapper(row, Number(guildId))
            );
        } catch (error) {
            logDB(
                "SELECT",
                "channels",
                startTime,
                false,
                `SELECT * FROM channels WHERE guildId = ${guildId}`,
                error
            );
            throw error;
        }
    },

    getChannelById: async (channelId) => {
        const startTime = Date.now();
        try {
            const [rows] = await db
                .promise()
                .execute("SELECT * FROM channels WHERE channelId = ?", [
                    channelId,
                ]);

            logDB(
                "SELECT",
                "channels",
                startTime,
                true,
                `SELECT * FROM channels WHERE channelId = ${channelId}`
            );
            return rows[0];
        } catch (error) {
            logDB(
                "SELECT",
                "channels",
                startTime,
                false,
                `SELECT * FROM channels WHERE channelId = ${channelId}`,
                error
            );
            throw error;
        }
    },

    getFirstChannelByGuildId: async (guildId) => {
        try {
            const startTime = Date.now();
            const [rows] = await db
                .promise()
                .execute("SELECT * FROM channels WHERE guildId = ? LIMIT 1", [
                    guildId,
                ]);

            logDB(
                "SELECT",
                "channels",
                startTime,
                true,
                `SELECT * FROM channels WHERE guildId = ${guildId} LIMIT 1`
            );

            return rows[0];
        } catch (error) {
            logDB(
                "SELECT",
                "channels",
                startTime,
                false,
                `SELECT * FROM channels WHERE guildId = ${guild.guildId} LIMIT 1`,
                error
            );
            throw error;
        }
    },

    createChannel: async (
        type,
        name,
        description,
        guildId = null,
        friendId = null,
        connection = db.promise()
    ) => {
        const startTime = Date.now();
        try {
            const [result] = await connection.execute(
                "INSERT INTO channels (type, name, description, guildId, friendId) VALUES (?, ?, ?, ?, ?)",
                [type, name, description, guildId, friendId]
            );

            const [channel] = await connection.execute(
                "SELECT * FROM channels WHERE channelId = ?",
                [result.insertId]
            );

            logDB("INSERT", "channels", startTime, true, "Création channel", {
                guildId,
                friendId,
            });
            return channel[0];
        } catch (error) {
            logDB(
                "INSERT",
                "channels",
                startTime,
                false,
                "Erreur création channel",
                error
            );
            throw error;
        }
    },

    getPrivateChannelsByUserId: async (userId) => {
        const startTime = Date.now();
        try {
            const [rows] = await db
                .promise()
                .execute(
                    "SELECT u.*, c.* FROM users as u INNER JOIN friends as f ON (f.friendId = u.userId AND f.userId = ?) OR (f.userId = u.userId AND f.friendId = ?) INNER JOIN channels as c ON f.id = c.friendId ",
                    [userId, userId]
                );
            logDB(
                "SELECT",
                "channels",
                startTime,
                true,
                `SELECT u.*, c.* FROM users as u INNER JOIN friends as f ON (f.friendId = u.userId AND f.userId = ?) OR (f.userId = u.userId AND f.friendId = ?) INNER JOIN channels as c ON f.id = c.friendId`,
                [userId, userId]
            );
            rows.map((row) => mappers.privateChannelMapper(row));
        } catch (error) {
            logDB(
                "SELECT",
                "channels",
                startTime,
                false,
                `SELECT u.*, c.* FROM users as u INNER JOIN friends as f ON (f.friendId = u.userId AND f.userId = ?) OR (f.userId = u.userId AND f.friendId = ?) INNER JOIN channels as c ON f.id = c.friendId`,
                error
            );
            throw error;
        }
    },
};
