CREATE TABLE user_blocks (
    blockerId BIGINT UNSIGNED NOT NULL,
    blockedId BIGINT UNSIGNED NOT NULL,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (blockerId, blockedId),
    KEY idx_blocks_blocked (blockedId),
    CONSTRAINT fk_blocks_blocker FOREIGN KEY (blockerId) REFERENCES users (userId) ON DELETE CASCADE,
    CONSTRAINT fk_blocks_blocked FOREIGN KEY (blockedId) REFERENCES users (userId) ON DELETE CASCADE,
    CONSTRAINT ck_blocks_not_self CHECK (blockerId <> blockedId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE contact_notes (
    authorId  BIGINT UNSIGNED NOT NULL,
    subjectId BIGINT UNSIGNED NOT NULL,
    body      VARCHAR(500) NOT NULL,
    updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (authorId, subjectId),
    CONSTRAINT fk_contact_notes_author FOREIGN KEY (authorId) REFERENCES users (userId) ON DELETE CASCADE,
    CONSTRAINT fk_contact_notes_subject FOREIGN KEY (subjectId) REFERENCES users (userId) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE message_reports (
    reportId   BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    guildId    BIGINT UNSIGNED NOT NULL,
    channelId  BIGINT UNSIGNED NOT NULL,
    messageId  BIGINT UNSIGNED NOT NULL,
    reporterId BIGINT UNSIGNED NOT NULL,
    reason     VARCHAR(500) NOT NULL,
    status     ENUM('open','resolved','rejected') NOT NULL DEFAULT 'open',
    resolvedBy BIGINT UNSIGNED NULL,
    resolvedAt DATETIME NULL,
    resolution VARCHAR(500) NULL,
    createdAt  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (reportId),
    UNIQUE KEY uq_reports_message_reporter (messageId, reporterId),
    KEY idx_reports_queue (guildId, status, createdAt DESC),
    CONSTRAINT fk_reports_guild FOREIGN KEY (guildId) REFERENCES guilds (guildId) ON DELETE CASCADE,
    CONSTRAINT fk_reports_channel FOREIGN KEY (channelId) REFERENCES channels (channelId) ON DELETE CASCADE,
    CONSTRAINT fk_reports_message FOREIGN KEY (messageId) REFERENCES messages (messageId) ON DELETE CASCADE,
    CONSTRAINT fk_reports_reporter FOREIGN KEY (reporterId) REFERENCES users (userId) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
