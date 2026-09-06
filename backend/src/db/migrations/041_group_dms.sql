ALTER TABLE channels
    ADD COLUMN isGroup TINYINT(1) NOT NULL DEFAULT 0 AFTER friendshipId,
    ADD COLUMN groupOwnerId BIGINT UNSIGNED NULL AFTER isGroup,
    ADD CONSTRAINT fk_channels_group_owner FOREIGN KEY (groupOwnerId) REFERENCES users (userId) ON DELETE SET NULL;

ALTER TABLE channels
    DROP CHECK ck_channels_owner;

ALTER TABLE channels
    ADD CONSTRAINT ck_channels_owner CHECK (
        (guildId IS NOT NULL AND friendshipId IS NULL AND isGroup = 0) OR
        (guildId IS NULL AND friendshipId IS NOT NULL AND isGroup = 0) OR
        (guildId IS NULL AND friendshipId IS NULL AND isGroup = 1)
    );

CREATE TABLE channel_participants (
    channelId BIGINT UNSIGNED NOT NULL,
    userId    BIGINT UNSIGNED NOT NULL,
    joinedAt  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (channelId, userId),
    KEY idx_participants_user (userId),
    CONSTRAINT fk_participants_channel FOREIGN KEY (channelId) REFERENCES channels (channelId) ON DELETE CASCADE,
    CONSTRAINT fk_participants_user    FOREIGN KEY (userId)    REFERENCES users    (userId)    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
