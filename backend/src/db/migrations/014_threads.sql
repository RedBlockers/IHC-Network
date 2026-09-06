ALTER TABLE messages
    ADD COLUMN threadRootId BIGINT UNSIGNED NULL AFTER channelId,
    ADD KEY idx_messages_thread (threadRootId, messageId);

CREATE TABLE message_threads (
    rootId             BIGINT UNSIGNED NOT NULL,
    channelId          BIGINT UNSIGNED NOT NULL,
    title              VARCHAR(100) NOT NULL,
    createdBy          BIGINT UNSIGNED NOT NULL,
    createdAt          DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    lastMessageAt      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    replyCount         INT UNSIGNED NOT NULL DEFAULT 0,
    autoArchiveMinutes INT UNSIGNED NOT NULL DEFAULT 4320,
    PRIMARY KEY (rootId),
    KEY idx_threads_channel (channelId, lastMessageAt DESC),
    CONSTRAINT fk_threads_root FOREIGN KEY (rootId) REFERENCES messages (messageId) ON DELETE CASCADE,
    CONSTRAINT fk_threads_channel FOREIGN KEY (channelId) REFERENCES channels (channelId) ON DELETE CASCADE,
    CONSTRAINT fk_threads_author FOREIGN KEY (createdBy) REFERENCES users (userId) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE thread_followers (
    rootId     BIGINT UNSIGNED NOT NULL,
    userId     BIGINT UNSIGNED NOT NULL,
    followedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (rootId, userId),
    KEY idx_followers_user (userId),
    CONSTRAINT fk_followers_thread FOREIGN KEY (rootId) REFERENCES message_threads (rootId) ON DELETE CASCADE,
    CONSTRAINT fk_followers_user FOREIGN KEY (userId) REFERENCES users (userId) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

ALTER TABLE notifications
    MODIFY COLUMN type ENUM('mention','reply','friend_request','sanction','thread') NOT NULL;
