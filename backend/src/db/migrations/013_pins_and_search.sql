ALTER TABLE messages
    MODIFY COLUMN content VARCHAR(3400) NOT NULL;

ALTER TABLE messages
    ADD FULLTEXT KEY ft_messages_content (content);

CREATE TABLE message_pins (
    channelId BIGINT UNSIGNED NOT NULL,
    messageId BIGINT UNSIGNED NOT NULL,
    pinnedBy  BIGINT UNSIGNED NOT NULL,
    pinnedAt  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (messageId),
    KEY idx_pins_channel (channelId, pinnedAt DESC),
    CONSTRAINT fk_pins_channel FOREIGN KEY (channelId) REFERENCES channels (channelId) ON DELETE CASCADE,
    CONSTRAINT fk_pins_message FOREIGN KEY (messageId) REFERENCES messages (messageId) ON DELETE CASCADE,
    CONSTRAINT fk_pins_user FOREIGN KEY (pinnedBy) REFERENCES users (userId) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
