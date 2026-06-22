const db = require("./connDB");
const logger = require("../utils/logger");
const { logDB } = require("../utils/helpers/logHelper");
const { log } = require("winston");
const { tr } = require("zod/locales");

module.exports = {
    getMessageById: async (id) => {
        const startTime = Date.now();
        try {
            const [rows] = await db
                .promise()
                .execute("SELECT * FROM message_content WHERE messageId = ?", [
                    id,
                ]);
            logDB(
                "SELECT",
                "message_content",
                startTime,
                true,
                `SELECT * FROM message_content WHERE messageId = ${id}`
            );
            return rows[0];
        } catch (err) {
            logDB(
                "ERROR",
                "message_content",
                startTime,
                false,
                `SELECT * FROM message_content WHERE messageId = ${id}`,
                err
            );
            throw err;
        }
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
            logDB(
                "INSERT",
                "messages",
                startTime,
                true,
                `INSERT INTO messages (userId, content, channelId) VALUES (${idUser}, ${message}, ${channel})`
            );
            return result;
        } catch (err) {
            logDB(
                "ERROR",
                "messages",
                startTime,
                false,
                `INSERT INTO messages (userId, content, channelId) VALUES (${idUser}, ${message}, ${channel})`,
                err
            );
            throw err;
        }
    },
    getMessagesByChannelId: async (channelId, guildId, limit, offset) => {
        const startTime = Date.now();
        try {
            // Requête avec pagination
            const [rows] = await db.promise().execute(
                `
                SELECT SQL_CALC_FOUND_ROWS *
                FROM message_content mc
                INNER JOIN messages ON messages.messageId = mc.messageId
                INNER JOIN channels ON channels.channelId = messages.channelId
                WHERE messages.channelId = ? AND channels.guildId = ?
                ORDER BY messages.messageId DESC
                LIMIT ? OFFSET ?
                `,
                [channelId, guildId, limit, offset]
            );

            // Récupération du nombre total pour savoir s'il y a plus de messages
            const [countRows] = await db
                .promise()
                .execute(`SELECT FOUND_ROWS() as total`);
            const total = countRows[0].total;
            const hasMoreMessages = offset + limit < total;

            logDB(
                "SELECT",
                "messages",
                startTime,
                true,
                `Messages paginés pour channel ${channelId} dans guild ${guildId}`,
                { limit, offset, count: rows.length }
            );

            return {
                messages: rows,
                hasMoreMessages,
            };
        } catch (err) {
            logDB(
                "ERROR",
                "messages",
                startTime,
                false,
                `Messages paginés pour channel ${channelId} dans guild ${guildId}`,
                err
            );
            throw err;
        }
    },

    getPrivateMessages: async (channelId, limit, offset) => {
        const startTime = Date.now();
        try {
            const [rows] = await db.promise().execute(
                `
                SELECT SQL_CALC_FOUND_ROWS *
                FROM message_content mc
                INNER JOIN messages ON messages.messageId = mc.messageId
                INNER JOIN channels ON channels.channelId = messages.channelId
                WHERE messages.channelId = ?
                ORDER BY messages.messageId DESC
                LIMIT ? OFFSET ?
                `,
                [channelId, limit, offset]
            );

            // Récupération du nombre total pour savoir s'il y a plus de messages
            const [countRows] = await db
                .promise()
                .execute(`SELECT FOUND_ROWS() as total`);
            const total = countRows[0].total;
            const hasMoreMessages = offset + limit < total;

            logDB(
                "SELECT",
                "messages",
                startTime,
                true,
                `Messages privés paginés pour channel ${channelId}`,
                { limit, offset, count: rows.length }
            );
            return {
                messages: rows,
                hasMoreMessages,
            };
        } catch (err) {
            logDB(
                "ERROR",
                "messages",
                startTime,
                false,
                `Messages privés paginés pour channel ${channelId}`,
                err
            );
            throw err;
        }
    },
};
