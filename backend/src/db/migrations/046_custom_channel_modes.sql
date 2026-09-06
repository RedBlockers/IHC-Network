CREATE TABLE guild_channel_modes (
    modeId    BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    guildId   BIGINT UNSIGNED NOT NULL,
    name      VARCHAR(40)     NOT NULL,
    baseType  VARCHAR(32)     NOT NULL,
    icon      VARCHAR(24)     NOT NULL DEFAULT 'hash',

    acceptsMessages     TINYINT(1)  NULL,
    requiresThread      TINYINT(1)  NULL,
    requiresPoll        TINYINT(1)  NULL,
    requiresAttachment  TINYINT(1)  NULL,
    pinnedFirst         TINYINT(1)  NULL,
    refusal             VARCHAR(200) NULL,

    createdBy BIGINT UNSIGNED NULL,
    createdAt DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (modeId),
    UNIQUE KEY uq_modes_name (guildId, name),
    CONSTRAINT fk_modes_guild FOREIGN KEY (guildId) REFERENCES guilds (guildId) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

ALTER TABLE channels
    ADD COLUMN customModeId BIGINT UNSIGNED NULL AFTER type,
    ADD CONSTRAINT fk_channels_mode FOREIGN KEY (customModeId)
        REFERENCES guild_channel_modes (modeId) ON DELETE SET NULL;
