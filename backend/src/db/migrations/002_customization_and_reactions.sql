ALTER TABLE guilds
    ADD COLUMN banner VARCHAR(512) NULL AFTER icon,
    ADD COLUMN accent CHAR(7) NULL AFTER banner;

ALTER TABLE messages
    ADD COLUMN replyToId BIGINT UNSIGNED NULL AFTER channelId,
    ADD CONSTRAINT fk_messages_reply FOREIGN KEY (replyToId) REFERENCES messages (messageId) ON DELETE SET NULL;

CREATE TABLE message_reactions (
    messageId BIGINT UNSIGNED NOT NULL,
    userId    BIGINT UNSIGNED NOT NULL,
    emoji     VARCHAR(32) NOT NULL,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (messageId, userId, emoji),
    KEY idx_reactions_message (messageId),
    CONSTRAINT fk_reactions_message FOREIGN KEY (messageId) REFERENCES messages (messageId) ON DELETE CASCADE,
    CONSTRAINT fk_reactions_user    FOREIGN KEY (userId)    REFERENCES users    (userId)    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
