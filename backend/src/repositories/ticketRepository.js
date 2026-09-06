"use strict";

const { query, queryOne } = require("../db/pool");

const COLUMNS =
    "ticketId, channelId, guildId, number, title, status, openedBy, assigneeId, createdAt, updatedAt, priority";

const ticketRepository = {
    nextNumber: async (channelId, connection) => {
        await queryOne(
            "tickets.lockChannel",
            "SELECT channelId FROM channels WHERE channelId = ? FOR UPDATE",
            [channelId],
            connection
        );
        return queryOne(
            "tickets.nextNumber",
            "SELECT COALESCE(MAX(number), 0) + 1 AS number FROM channel_tickets WHERE channelId = ?",
            [channelId],
            connection
        );
    },

    create: async (data, connection) => {
        const result = await query(
            "tickets.create",
            "INSERT INTO channel_tickets (channelId, guildId, number, title, openedBy, priority) VALUES (?, ?, ?, ?, ?, ?)",
            [data.channelId, data.guildId, data.number, data.title, data.openedBy, data.priority || "normal"],
            connection
        );
        return result.insertId;
    },

    findById: (ticketId, connection) =>
        queryOne(
            "tickets.findById",
            `SELECT t.${COLUMNS.split(", ").join(", t.")},
            o.handle AS openerHandle, o.displayName AS openerDisplayName, o.avatar AS openerAvatar,
            a.handle AS assigneeHandle, a.displayName AS assigneeDisplayName
            FROM channel_tickets t JOIN users o ON o.userId = t.openedBy
            LEFT JOIN users a ON a.userId = t.assigneeId WHERE t.ticketId = ?`,
            [ticketId],
            connection
        ),

    listByChannel: (channelId, { status, openedBy, limit, offset = 0, search = "" }, connection) => {
        const rows = Math.min(Math.max(Number.parseInt(limit, 10) || 50, 1), 100);

        return query(
            "tickets.listByChannel",
            `SELECT t.${COLUMNS.split(", ").join(", t.")},
                    o.handle AS openerHandle, o.displayName AS openerDisplayName, o.avatar AS openerAvatar,
                    a.handle AS assigneeHandle, a.displayName AS assigneeDisplayName
               FROM channel_tickets t
               JOIN users o ON o.userId = t.openedBy
               LEFT JOIN users a ON a.userId = t.assigneeId
              WHERE t.channelId = ?
                ${status ? "AND t.status = ?" : ""}
                ${openedBy ? "AND t.openedBy = ?" : ""}
                ${search ? "AND (t.title LIKE ? OR o.handle LIKE ? OR o.displayName LIKE ? OR CAST(t.number AS CHAR) = ?)" : ""}
              ORDER BY FIELD(t.priority, 'urgent', 'high', 'normal', 'low'), t.updatedAt DESC, t.ticketId DESC
              LIMIT ${rows} OFFSET ${Math.max(0, Number.parseInt(offset, 10) || 0)}`,
            [
                channelId,
                ...(status ? [status] : []),
                ...(openedBy ? [openedBy] : []),
                ...(search ? [`%${search}%`, `%${search}%`, `%${search}%`, search.replace(/^#/, "")] : []),
            ],
            connection
        );
    },

    update: async (ticketId, fields, connection) => {
        const entries = Object.entries(fields);
        if (entries.length === 0) return false;
        const result = await query(
            "tickets.update",
            `UPDATE channel_tickets SET ${entries.map(([key]) => `${key} = ?`).join(", ")} WHERE ticketId = ?`,
            [...entries.map(([, value]) => value), ticketId],
            connection
        );
        return result.affectedRows > 0;
    },

    addMessage: (ticketId, userId, body, internal, connection) =>
        query(
            "tickets.addMessage",
            "INSERT INTO ticket_messages (ticketId, userId, body, internal) VALUES (?, ?, ?, ?)",
            [ticketId, userId, body, internal ? 1 : 0],
            connection
        ),

    listMessages: (ticketId, includeInternal, connection) =>
        query(
            "tickets.listMessages",
            `SELECT m.ticketMessageId, m.body, m.internal, m.createdAt,
                    u.userId, u.handle, u.displayName, u.avatar, u.avatarDecoration
               FROM ticket_messages m JOIN users u ON u.userId = m.userId
              WHERE m.ticketId = ? ${includeInternal ? "" : "AND m.internal = 0"}
              ORDER BY m.ticketMessageId ASC`,
            [ticketId],
            connection
        ),
};

module.exports = ticketRepository;
