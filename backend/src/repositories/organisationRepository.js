"use strict";

const { query, queryOne } = require("../db/pool");

const organisationRepository = {
    listFolders: (userId, connection) =>
        query(
            "organisation.listFolders",
            `SELECT folderId, name, color, position
             FROM guild_folders
             WHERE userId = ?
             ORDER BY position ASC, folderId ASC`,
            [userId],
            connection
        ),

    createFolder: async (userId, { name, color, position }, connection) => {
        const result = await query(
            "organisation.createFolder",
            "INSERT INTO guild_folders (userId, name, color, position) VALUES (?, ?, ?, ?)",
            [userId, name, color, position],
            connection
        );
        return Number(result.insertId);
    },

    nextFolderPosition: (userId, connection) =>
        queryOne(
            "organisation.nextFolderPosition",
            "SELECT COALESCE(MAX(position) + 1, 0) AS position FROM guild_folders WHERE userId = ?",
            [userId],
            connection
        ),

    updateFolder: (userId, folderId, { name, color }, connection) =>
        query(
            "organisation.updateFolder",
            "UPDATE guild_folders SET name = ?, color = ? WHERE folderId = ? AND userId = ?",
            [name, color, folderId, userId],
            connection
        ),

    deleteFolder: (userId, folderId, connection) =>
        query(
            "organisation.deleteFolder",
            "DELETE FROM guild_folders WHERE folderId = ? AND userId = ?",
            [folderId, userId],
            connection
        ),

    listGuildPrefs: (userId, connection) =>
        query(
            "organisation.listGuildPrefs",
            "SELECT guildId, folderId, isFavorite, position FROM user_guild_prefs WHERE userId = ?",
            [userId],
            connection
        ),

    setGuildPref: (userId, guildId, { folderId, isFavorite, position }, connection) =>
        query(
            "organisation.setGuildPref",
            `INSERT INTO user_guild_prefs (userId, guildId, folderId, isFavorite, position)
             VALUES (?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
                 folderId = VALUES(folderId),
                 isFavorite = VALUES(isFavorite),
                 position = VALUES(position)`,
            [userId, guildId, folderId, isFavorite ? 1 : 0, position],
            connection
        ),

    findGuildPref: (userId, guildId, connection) =>
        queryOne(
            "organisation.findGuildPref",
            "SELECT guildId, folderId, isFavorite, position FROM user_guild_prefs WHERE userId = ? AND guildId = ?",
            [userId, guildId],
            connection
        ),

    listChannelPrefs: (userId, connection) =>
        query(
            "organisation.listChannelPrefs",
            "SELECT channelId, isFavorite FROM user_channel_prefs WHERE userId = ? AND isFavorite = 1",
            [userId],
            connection
        ),

    setChannelFavorite: (userId, channelId, isFavorite, connection) =>
        query(
            "organisation.setChannelFavorite",
            `INSERT INTO user_channel_prefs (userId, channelId, isFavorite)
             VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE isFavorite = VALUES(isFavorite)`,
            [userId, channelId, isFavorite ? 1 : 0],
            connection
        ),

    findDisplayPrefs: (userId, connection) =>
        queryOne(
            "organisation.findDisplayPrefs",
            "SELECT hideReadChannels FROM users WHERE userId = ?",
            [userId],
            connection
        ),

    setHideReadChannels: (userId, hide, connection) =>
        query(
            "organisation.setHideReadChannels",
            "UPDATE users SET hideReadChannels = ? WHERE userId = ?",
            [hide ? 1 : 0, userId],
            connection
        ),
};

module.exports = organisationRepository;
