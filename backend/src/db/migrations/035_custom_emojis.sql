CREATE TABLE guild_emojis (
    emojiId   BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    guildId   BIGINT UNSIGNED NOT NULL,
    name      VARCHAR(32) NOT NULL,
    url       VARCHAR(500) NOT NULL,
    storageKey VARCHAR(500) NOT NULL,
    createdBy BIGINT UNSIGNED NOT NULL,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (emojiId),
    UNIQUE KEY uq_guild_emoji_name (guildId, name),
    CONSTRAINT fk_emoji_guild  FOREIGN KEY (guildId)   REFERENCES guilds (guildId) ON DELETE CASCADE,
    CONSTRAINT fk_emoji_author FOREIGN KEY (createdBy) REFERENCES users  (userId)  ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
