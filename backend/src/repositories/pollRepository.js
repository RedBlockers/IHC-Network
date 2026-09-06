"use strict";

const { query, queryOne } = require("../db/pool");

const pollRepository = {
    create: async (data, connection) => {
        const result = await query(
            "polls.create",
            "INSERT INTO polls (channelId, messageId, question, anonymous, closesAt, createdBy) VALUES (?, ?, ?, ?, ?, ?)",
            [data.channelId, data.messageId, data.question, data.anonymous ? 1 : 0, data.closesAt, data.createdBy],
            connection
        );
        return result.insertId;
    },

    createOption: (pollId, label, position, connection) =>
        query(
            "polls.createOption",
            "INSERT INTO poll_options (pollId, label, position) VALUES (?, ?, ?)",
            [pollId, label, position],
            connection
        ),

    findByMessage: (messageId, connection) =>
        queryOne(
            "polls.findByMessage",
            `SELECT pollId, channelId, CAST(messageId AS CHAR) AS messageId, question, anonymous, closesAt, closedAt, createdBy
               FROM polls WHERE messageId = ?`,
            [messageId],
            connection
        ),

    listOptions: (pollId, connection) =>
        query(
            "polls.listOptions",
            "SELECT optionId, label, position FROM poll_options WHERE pollId = ? ORDER BY position ASC",
            [pollId],
            connection
        ),

    tally: (pollId, connection) =>
        query(
            "polls.tally",
            "SELECT optionId, COUNT(*) AS votes FROM poll_votes WHERE pollId = ? GROUP BY optionId",
            [pollId],
            connection
        ),

    voteOf: (pollId, userId, connection) =>
        queryOne(
            "polls.voteOf",
            "SELECT optionId FROM poll_votes WHERE pollId = ? AND userId = ?",
            [pollId, userId],
            connection
        ),

    vote: (pollId, userId, optionId, connection) =>
        query(
            "polls.vote",
            `INSERT INTO poll_votes (pollId, userId, optionId) VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE optionId = VALUES(optionId)`,
            [pollId, userId, optionId],
            connection
        ),

    optionBelongs: async (pollId, optionId, connection) => {
        const row = await queryOne(
            "polls.optionBelongs",
            "SELECT 1 AS ok FROM poll_options WHERE pollId = ? AND optionId = ?",
            [pollId, optionId],
            connection
        );
        return row !== null;
    },

    close: async (pollId, userId, connection) => {
        const result = await query(
            "polls.close",
            "UPDATE polls SET closedAt = NOW() WHERE pollId = ? AND createdBy = ? AND closedAt IS NULL",
            [pollId, userId],
            connection
        );
        return result.affectedRows > 0;
    },
};

module.exports = pollRepository;
