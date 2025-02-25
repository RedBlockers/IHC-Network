const db = require("./connDB");
const logger = require("../utils/logger");

module.exports = {
    getAllMessages: async () => {
        logger.info("Getting all messages");
        const [rows] = await db
            .promise()
            .execute("SELECT * FROM message_content");
        return rows;
    },
    getMessageById: async (id) => {
        logger.info("Getting message by id " + id);
        const [rows] = await db
            .promise()
            .execute("SELECT * FROM message_content WHERE messageId = ?", [id]);
        return rows[0];
    },
    insertMessage: async (idUser, message, channel) => {
        try {
            const [result] = await db
                .promise()
                .execute(
                    "INSERT INTO messages (userId, content, channelId) VALUES (?, ?, ?)",
                    [idUser, message, channel]
                );
            logger.info(
                `Inserted new message user:${idUser}, messageId:${result.insertId}`
            );
            return result;
        } catch (err) {
            console.error("Erreur lors de l'insertion du message :", err);
            return false;
        }
    },
    getMessagesByChannelId: async (channelId, guildId) => {
        channelId, guildId;
        logger.info("Getting messages for channel id " + channelId);
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
        return rows;
    },
    getPrivateMessages: async (channelId) => {
        logger.info("Getting private messages for channel id " + channelId);
        const [rows] = await db.promise().execute(
            `
            SELECT * 
            FROM message_content mc 
            INNER JOIN messages ON messages.messageId = mc.messageId 
            WHERE messages.channelId = ?
        `,
            [channelId]
        );
        return rows;
    },
};
