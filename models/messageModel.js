const db = require("./connDB");
const logger = require("../utils/logger");

module.exports = {
    getMessageById: async (id) => {
        const startTime = Date.now();
        const [rows] = await db
            .promise()
            .execute("SELECT * FROM message_content WHERE messageId = ?", [id]);
        logger.debug({
            event: "DBQuery",
            operation: "SELECT",
            table: "message_content",
            querySummary: `SELECT * FROM message_content WHERE messageId = ${id}`,
            duration: Date.now() - startTime,
            success: true,
        });
        return rows[0];
    },
    insertMessage: async (idUser, message, channel) => {
        const startTime = Date.now();
        try {
            const [result] = await db
                .promise()
                .execute(
                    "INSERT INTO messages (userId, content, channelId) VALUES (?, ?, ?)",
                    [idUser, message, channel]
                );
            logger.debug({
                event: "DBQuery",
                operation: "INSERT",
                table: "messages",
                querySummary:
                    "INSERT INTO messages (userId, content, channelId) VALUES (?, ?, ?)",
                parameters: [idUser, "message", channel],
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
            return false;
        }
    },
    getMessagesByChannelId: async (channelId, guildId) => {
        const startTime = Date.now();
        const [rows] = await db.promise().execute(
            `
            SELECT * 
            FROM message_content mc 
            INNER JOIN messages ON messages.messageId = mc.messageId 
            INNER JOIN channels ON channels.channelId = messages.channelId 
            WHERE messages.channelId = ? AND channels.guildId = ?
        `,
            [channelId, guildId]
        );
        logger.debug({
            event: "DBQuery",
            operation: "SELECT",
            table: "messages",
            querySummary: `SELECT * FROM message_content mc INNER JOIN messages ON messages.messageId = mc.messageId INNER JOIN channels ON channels.channelId = messages.channelId WHERE messages.channelId = ${channelId} AND channels.guildId = ${guildId}`,
            duration: Date.now() - startTime,
            success: true,
        });
        return rows;
    },
    getPrivateMessages: async (channelId) => {
        const startTime = Date.now();
        const [rows] = await db.promise().execute(
            `
            SELECT * 
            FROM message_content mc 
            INNER JOIN messages ON messages.messageId = mc.messageId 
            WHERE messages.channelId = ?
        `,
            [channelId]
        );
        logger.debug({
            event: "DBQuery",
            operation: "SELECT",
            table: "messages",
            querySummary: `SELECT * FROM message_content mc INNER JOIN messages ON messages.messageId = mc.messageId WHERE messages.channelId = ${channelId}`,
            duration: Date.now() - startTime,
            success: true,
        });
        return rows;
    },
};
