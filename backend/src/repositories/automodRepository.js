"use strict";

const { query, queryOne } = require("../db/pool");

const automodRepository = {
    findConfig: (guildId, connection) =>
        queryOne(
            "automod.findConfig",
            `SELECT guildId, enabled, blockedWords, blockedDomains, spamMessages, spamSeconds,
                    raidJoins, raidSeconds, action
               FROM guild_automod WHERE guildId = ?`,
            [guildId],
            connection
        ),

    upsertConfig: (guildId, config, connection) =>
        query(
            "automod.upsertConfig",
            `INSERT INTO guild_automod
                (guildId, enabled, blockedWords, blockedDomains, spamMessages, spamSeconds, raidJoins, raidSeconds, action)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
                enabled = VALUES(enabled), blockedWords = VALUES(blockedWords), blockedDomains = VALUES(blockedDomains),
                spamMessages = VALUES(spamMessages), spamSeconds = VALUES(spamSeconds),
                raidJoins = VALUES(raidJoins), raidSeconds = VALUES(raidSeconds), action = VALUES(action)`,
            [
                guildId,
                config.enabled ? 1 : 0,
                config.blockedWords,
                config.blockedDomains,
                config.spamMessages,
                config.spamSeconds,
                config.raidJoins,
                config.raidSeconds,
                config.action,
            ],
            connection
        ),
};

module.exports = automodRepository;
