CREATE TABLE guild_automod (
    guildId        BIGINT UNSIGNED NOT NULL,
    enabled        TINYINT(1) NOT NULL DEFAULT 0,
    blockedWords   TEXT NOT NULL,
    blockedDomains TEXT NOT NULL,
    spamMessages   INT UNSIGNED NOT NULL DEFAULT 0,
    spamSeconds    INT UNSIGNED NOT NULL DEFAULT 0,
    raidJoins      INT UNSIGNED NOT NULL DEFAULT 0,
    raidSeconds    INT UNSIGNED NOT NULL DEFAULT 0,
    action         ENUM('flag','delete') NOT NULL DEFAULT 'flag',
    updatedAt      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (guildId),
    CONSTRAINT fk_automod_guild FOREIGN KEY (guildId) REFERENCES guilds (guildId) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
