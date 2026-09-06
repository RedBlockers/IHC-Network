CREATE TABLE channel_categories (
    categoryId BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    guildId    BIGINT UNSIGNED NOT NULL,
    name       VARCHAR(40) NOT NULL,
    position   INT UNSIGNED NOT NULL DEFAULT 0,
    createdAt  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (categoryId),
    KEY idx_categories_guild (guildId, position),
    CONSTRAINT fk_categories_guild FOREIGN KEY (guildId) REFERENCES guilds (guildId) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

ALTER TABLE channels
    ADD COLUMN categoryId BIGINT UNSIGNED NULL AFTER guildId,
    ADD KEY idx_channels_category (categoryId),
    ADD CONSTRAINT fk_channels_category FOREIGN KEY (categoryId) REFERENCES channel_categories (categoryId) ON DELETE SET NULL;
