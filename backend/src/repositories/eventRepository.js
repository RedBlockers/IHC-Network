"use strict";

const { query, queryOne } = require("../db/pool");

const COLUMNS =
    "eventId, channelId, guildId, title, description, location, startsAt, endsAt, createdBy, cancelledAt, createdAt";

const eventRepository = {
    create: async (data, connection) => {
        const result = await query(
            "events.create",
            `INSERT INTO channel_events (channelId, guildId, title, description, location, startsAt, endsAt, createdBy)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                data.channelId,
                data.guildId,
                data.title,
                data.description,
                data.location,
                data.startsAt,
                data.endsAt,
                data.createdBy,
            ],
            connection
        );
        return result.insertId;
    },

    findById: (eventId, connection) =>
        queryOne("events.findById", `SELECT ${COLUMNS} FROM channel_events WHERE eventId = ?`, [eventId], connection),

    upcomingForChannels: (channelIds, limit, connection) => {
        if (channelIds.length === 0) return Promise.resolve([]);
        const placeholders = channelIds.map(() => "?").join(",");
        return query(
            "events.upcomingForChannels",
            `SELECT e.${COLUMNS.split(", ").join(", e.")}, u.handle AS authorHandle, u.displayName AS authorDisplayName, u.avatar AS authorAvatar, u.avatarDecoration AS authorDecoration
               FROM channel_events e JOIN users u ON u.userId = e.createdBy
              WHERE e.channelId IN (${placeholders})
                AND e.cancelledAt IS NULL
                AND e.startsAt >= NOW()
              ORDER BY e.startsAt ASC
              LIMIT ${Math.min(Math.max(limit, 1), 20)}`,
            channelIds,
            connection
        );
    },

    listByChannel: (channelId, limit, connection) =>
        query(
            "events.listByChannel",
            `SELECT e.${COLUMNS.split(", ").join(", e.")}, u.handle AS authorHandle, u.displayName AS authorDisplayName, u.avatar AS authorAvatar, u.avatarDecoration AS authorDecoration
               FROM channel_events e JOIN users u ON u.userId = e.createdBy
              WHERE e.channelId = ?
              ORDER BY e.startsAt ASC
              LIMIT ?`,
            [channelId, limit],
            connection
        ),

    update: async (eventId, fields, connection) => {
        const entries = Object.entries(fields);
        if (entries.length === 0) return false;
        const result = await query(
            "events.update",
            `UPDATE channel_events SET ${entries.map(([key]) => `${key} = ?`).join(", ")} WHERE eventId = ?`,
            [...entries.map(([, value]) => value), eventId],
            connection
        );
        return result.affectedRows > 0;
    },

    cancel: async (eventId, connection) => {
        const result = await query(
            "events.cancel",
            "UPDATE channel_events SET cancelledAt = NOW() WHERE eventId = ? AND cancelledAt IS NULL",
            [eventId],
            connection
        );
        return result.affectedRows > 0;
    },

    respond: (eventId, userId, response, connection) =>
        query(
            "events.respond",
            `INSERT INTO event_participants (eventId, userId, response) VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE response = VALUES(response)`,
            [eventId, userId, response],
            connection
        ),

    tally: (eventId, connection) =>
        query(
            "events.tally",
            "SELECT response, COUNT(*) AS total FROM event_participants WHERE eventId = ? GROUP BY response",
            [eventId],
            connection
        ),

    responseOf: (eventId, userId, connection) =>
        queryOne(
            "events.responseOf",
            "SELECT response FROM event_participants WHERE eventId = ? AND userId = ?",
            [eventId, userId],
            connection
        ),

    listInterested: (eventId, connection) =>
        query(
            "events.listInterested",
            "SELECT userId FROM event_participants WHERE eventId = ? AND response IN ('going','maybe')",
            [eventId],
            connection
        ),
};

module.exports = eventRepository;
