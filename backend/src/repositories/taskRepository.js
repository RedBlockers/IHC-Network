"use strict";

const { query, queryOne } = require("../db/pool");

const COLUMNS =
    "taskId, channelId, guildId, title, details, status, assigneeId, dueAt, position, createdBy, createdAt, completedAt";

const taskRepository = {
    nextPosition: (channelId, status, connection) =>
        queryOne(
            "tasks.nextPosition",
            "SELECT COALESCE(MAX(position), 0) + 1 AS position FROM channel_tasks WHERE channelId = ? AND status = ?",
            [channelId, status],
            connection
        ),

    create: async (data, connection) => {
        const result = await query(
            "tasks.create",
            `INSERT INTO channel_tasks (channelId, guildId, title, details, assigneeId, dueAt, position, createdBy)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [data.channelId, data.guildId, data.title, data.details, data.assigneeId, data.dueAt, data.position, data.createdBy],
            connection
        );
        return result.insertId;
    },

    findById: (taskId, connection) =>
        queryOne("tasks.findById", `SELECT ${COLUMNS} FROM channel_tasks WHERE taskId = ?`, [taskId], connection),

    listByChannel: (channelId, connection) =>
        query(
            "tasks.listByChannel",
            `SELECT t.${COLUMNS.split(", ").join(", t.")},
                    a.handle AS assigneeHandle, a.displayName AS assigneeDisplayName, a.avatar AS assigneeAvatar
               FROM channel_tasks t
               LEFT JOIN users a ON a.userId = t.assigneeId
              WHERE t.channelId = ?
              ORDER BY FIELD(t.status, 'todo', 'doing', 'done'), t.position ASC, t.taskId ASC`,
            [channelId],
            connection
        ),

    update: async (taskId, fields, connection) => {
        const entries = Object.entries(fields);
        if (entries.length === 0) return false;
        const result = await query(
            "tasks.update",
            `UPDATE channel_tasks SET ${entries.map(([key]) => `${key} = ?`).join(", ")} WHERE taskId = ?`,
            [...entries.map(([, value]) => value), taskId],
            connection
        );
        return result.affectedRows > 0;
    },

    remove: async (taskId, channelId, connection) => {
        const result = await query(
            "tasks.remove",
            "DELETE FROM channel_tasks WHERE taskId = ? AND channelId = ?",
            [taskId, channelId],
            connection
        );
        return result.affectedRows > 0;
    },
};

module.exports = taskRepository;
