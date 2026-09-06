CREATE TABLE guild_themes (
    themeId    BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    guildId    BIGINT UNSIGNED NOT NULL,
    tokens     JSON            NOT NULL,
    label      VARCHAR(60)     NOT NULL DEFAULT '',
    effectiveAt DATETIME       NOT NULL,
    createdBy  BIGINT UNSIGNED NULL,
    createdAt  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (themeId),
    KEY idx_themes_active (guildId, effectiveAt DESC),
    CONSTRAINT fk_themes_guild FOREIGN KEY (guildId) REFERENCES guilds (guildId) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

ALTER TABLE guilds
    ADD COLUMN bannerFocusX TINYINT UNSIGNED NOT NULL DEFAULT 50 AFTER bannerImage,
    ADD COLUMN bannerFocusY TINYINT UNSIGNED NOT NULL DEFAULT 50 AFTER bannerFocusX;
