"use strict";

const { query, queryOne } = require("../db/pool");

const COLUMNS = "categoryId, guildId, name, position";

const categoryRepository = {
    listByGuild: (guildId, connection) =>
        query(
            "categories.listByGuild",
            `SELECT ${COLUMNS} FROM channel_categories WHERE guildId = ? ORDER BY position ASC, categoryId ASC`,
            [guildId],
            connection
        ),

    findById: (categoryId, connection) =>
        queryOne("categories.findById", `SELECT ${COLUMNS} FROM channel_categories WHERE categoryId = ?`, [categoryId], connection),

    nextPosition: (guildId, connection) =>
        queryOne(
            "categories.nextPosition",
            "SELECT COALESCE(MAX(position), 0) + 1 AS position FROM channel_categories WHERE guildId = ?",
            [guildId],
            connection
        ),

    create: async (data, connection) => {
        const result = await query(
            "categories.create",
            "INSERT INTO channel_categories (guildId, name, position) VALUES (?, ?, ?)",
            [data.guildId, data.name, data.position],
            connection
        );
        return result.insertId;
    },

    update: async (categoryId, guildId, { name, position }, connection) => {
        const result = await query(
            "categories.update",
            "UPDATE channel_categories SET name = ?, position = ? WHERE categoryId = ? AND guildId = ?",
            [name, position, categoryId, guildId],
            connection
        );
        return result.affectedRows > 0;
    },

    setPosition: (categoryId, guildId, position, connection) =>
        query(
            "categories.setPosition",
            "UPDATE channel_categories SET position = ? WHERE categoryId = ? AND guildId = ?",
            [position, categoryId, guildId],
            connection
        ),

    delete: async (categoryId, guildId, connection) => {
        const result = await query(
            "categories.delete",
            "DELETE FROM channel_categories WHERE categoryId = ? AND guildId = ?",
            [categoryId, guildId],
            connection
        );
        return result.affectedRows > 0;
    },
};

module.exports = categoryRepository;
