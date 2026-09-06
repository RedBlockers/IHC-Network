CREATE TABLE guild_folders (
    folderId  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    userId    BIGINT UNSIGNED NOT NULL,
    name      VARCHAR(40) NOT NULL,
    color     CHAR(7) NULL,
    position  INT UNSIGNED NOT NULL DEFAULT 0,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (folderId),
    KEY idx_folders_user (userId, position, folderId),
    CONSTRAINT fk_folders_user FOREIGN KEY (userId) REFERENCES users (userId) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE user_guild_prefs (
    userId     BIGINT UNSIGNED NOT NULL,
    guildId    BIGINT UNSIGNED NOT NULL,
    folderId   BIGINT UNSIGNED NULL,
    isFavorite TINYINT(1) NOT NULL DEFAULT 0,
    position   INT UNSIGNED NOT NULL DEFAULT 0,
    PRIMARY KEY (userId, guildId),
    KEY idx_guild_prefs_folder (userId, folderId, position),
    CONSTRAINT fk_guild_prefs_user   FOREIGN KEY (userId)   REFERENCES users        (userId)   ON DELETE CASCADE,
    CONSTRAINT fk_guild_prefs_guild  FOREIGN KEY (guildId)  REFERENCES guilds       (guildId)  ON DELETE CASCADE,
    CONSTRAINT fk_guild_prefs_folder FOREIGN KEY (folderId) REFERENCES guild_folders(folderId) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE user_channel_prefs (
    userId     BIGINT UNSIGNED NOT NULL,
    channelId  BIGINT UNSIGNED NOT NULL,
    isFavorite TINYINT(1) NOT NULL DEFAULT 0,
    PRIMARY KEY (userId, channelId),
    KEY idx_channel_prefs_user (userId, isFavorite),
    CONSTRAINT fk_channel_prefs_user    FOREIGN KEY (userId)    REFERENCES users    (userId)    ON DELETE CASCADE,
    CONSTRAINT fk_channel_prefs_channel FOREIGN KEY (channelId) REFERENCES channels (channelId) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

ALTER TABLE users
    ADD COLUMN hideReadChannels TINYINT(1) NOT NULL DEFAULT 0 AFTER digestFrequency;
