"use strict";

const { query } = require("../db/pool");

const collaborationRepository = {
    listStrokes: (channelId, connection) =>
        query(
            "collab.listStrokes",
            `SELECT strokeId, channelId, userId, color, points, createdAt
               FROM channel_whiteboard_strokes WHERE channelId = ?
              ORDER BY strokeId ASC`,
            [channelId],
            connection
        ),

    addStroke: async (data, connection) => {
        const result = await query(
            "collab.addStroke",
            "INSERT INTO channel_whiteboard_strokes (channelId, userId, color, points) VALUES (?, ?, ?, ?)",
            [data.channelId, data.userId, data.color, JSON.stringify(data.points)],
            connection
        );
        return result.insertId;
    },

    clearStrokes: (channelId, connection) =>
        query(
            "collab.clearStrokes",
            "DELETE FROM channel_whiteboard_strokes WHERE channelId = ?",
            [channelId],
            connection
        ),

    addTranscript: async (data, connection) => {
        const result = await query(
            "collab.addTranscript",
            "INSERT INTO channel_transcripts (channelId, userId, text, consented) VALUES (?, ?, ?, 1)",
            [data.channelId, data.userId, data.text],
            connection
        );
        return result.insertId;
    },

    listTranscripts: (channelId, connection) =>
        query(
            "collab.listTranscripts",
            `SELECT t.transcriptId, t.channelId, t.userId, t.text, t.createdAt, u.handle, u.displayName
               FROM channel_transcripts t
               JOIN users u ON u.userId = t.userId
              WHERE t.channelId = ?
              ORDER BY t.transcriptId DESC`,
            [channelId],
            connection
        ),

    addSummary: async (data, connection) => {
        const result = await query(
            "collab.addSummary",
            "INSERT INTO channel_summaries (channelId, userId, body, method) VALUES (?, ?, ?, ?)",
            [data.channelId, data.userId, data.body, data.method || "extractive"],
            connection
        );
        return result.insertId;
    },

    listSummaries: (channelId, connection) =>
        query(
            "collab.listSummaries",
            `SELECT s.summaryId, s.channelId, s.userId, s.body, s.method, s.createdAt, u.handle, u.displayName
               FROM channel_summaries s
               JOIN users u ON u.userId = s.userId
              WHERE s.channelId = ?
              ORDER BY s.summaryId DESC`,
            [channelId],
            connection
        ),
};

module.exports = collaborationRepository;
