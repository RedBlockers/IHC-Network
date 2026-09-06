CREATE TABLE channel_webhooks (
    webhookId  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    channelId  BIGINT UNSIGNED NOT NULL,
    guildId    BIGINT UNSIGNED NOT NULL,
    name       VARCHAR(50) NOT NULL,
    tokenHash  CHAR(64) NOT NULL,
    createdBy  BIGINT UNSIGNED NOT NULL,
    createdAt  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    lastUsedAt DATETIME NULL,
    uses       INT UNSIGNED NOT NULL DEFAULT 0,
    revokedAt  DATETIME NULL,
    PRIMARY KEY (webhookId),
    UNIQUE KEY uq_webhook_token (tokenHash),
    KEY idx_webhooks_channel (channelId, revokedAt),
    CONSTRAINT fk_webhook_channel FOREIGN KEY (channelId) REFERENCES channels (channelId) ON DELETE CASCADE,
    CONSTRAINT fk_webhook_guild   FOREIGN KEY (guildId)   REFERENCES guilds   (guildId)   ON DELETE CASCADE,
    CONSTRAINT fk_webhook_author  FOREIGN KEY (createdBy) REFERENCES users    (userId)    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

ALTER TABLE messages
    ADD COLUMN webhookName VARCHAR(50) NULL AFTER clientNonce;
