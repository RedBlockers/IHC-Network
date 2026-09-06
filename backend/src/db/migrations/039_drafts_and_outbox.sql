CREATE TABLE message_drafts (
    userId    BIGINT UNSIGNED NOT NULL,
    channelId BIGINT UNSIGNED NOT NULL,
    content   VARCHAR(3400) NOT NULL,
    updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (userId, channelId),
    CONSTRAINT fk_draft_user    FOREIGN KEY (userId)    REFERENCES users    (userId)    ON DELETE CASCADE,
    CONSTRAINT fk_draft_channel FOREIGN KEY (channelId) REFERENCES channels (channelId) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

ALTER TABLE messages
    ADD COLUMN clientNonce CHAR(36) NULL AFTER content,
    ADD UNIQUE KEY uq_messages_nonce (channelId, userId, clientNonce);
