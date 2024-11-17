const db = require("./connDB");
const logger = require("../utils/logger");

module.exports = {
    getAllMessages: async () => {
        logger.info("Getting all messages");
        const [rows] = await db.promise().execute("SELECT * FROM message_content");
        return rows;
    },
    getMessageById: async (id) => {
        logger.info("Getting message by id "+ id);
        const [rows] = await db.promise().execute("SELECT * FROM message_content WHERE messageId = ?",[id]);
        return rows[0];
    },
    insertMessage: async (idUser, message) => {
        try {
            const [result] = await db.promise().execute("INSERT INTO messages (userId, content) VALUES (?, ?)", [idUser, message]);
            logger.info(`Inserted new message user:${idUser}, messageId:${result.insertId}`);
            return result;
        } catch (err) {
            console.error('Erreur lors de l\'insertion du message :', err);
            return false;
        }
    },
}