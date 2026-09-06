ALTER TABLE channels
    MODIFY COLUMN type ENUM('text','voice','announcement','forum','poll') NOT NULL DEFAULT 'text';

CREATE TABLE polls (
    pollId     BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    channelId  BIGINT UNSIGNED NOT NULL,
    messageId  BIGINT UNSIGNED NOT NULL,
    question   VARCHAR(300) NOT NULL,
    anonymous  TINYINT(1) NOT NULL DEFAULT 1,
    closesAt   DATETIME NULL,
    closedAt   DATETIME NULL,
    createdBy  BIGINT UNSIGNED NOT NULL,
    createdAt  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (pollId),
    UNIQUE KEY uq_polls_message (messageId),
    KEY idx_polls_channel (channelId, createdAt DESC),
    CONSTRAINT fk_polls_channel FOREIGN KEY (channelId) REFERENCES channels (channelId) ON DELETE CASCADE,
    CONSTRAINT fk_polls_message FOREIGN KEY (messageId) REFERENCES messages (messageId) ON DELETE CASCADE,
    CONSTRAINT fk_polls_author FOREIGN KEY (createdBy) REFERENCES users (userId) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE poll_options (
    optionId BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    pollId   BIGINT UNSIGNED NOT NULL,
    label    VARCHAR(120) NOT NULL,
    position INT UNSIGNED NOT NULL DEFAULT 0,
    PRIMARY KEY (optionId),
    KEY idx_poll_options_poll (pollId, position),
    CONSTRAINT fk_poll_options_poll FOREIGN KEY (pollId) REFERENCES polls (pollId) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE poll_votes (
    pollId   BIGINT UNSIGNED NOT NULL,
    userId   BIGINT UNSIGNED NOT NULL,
    optionId BIGINT UNSIGNED NOT NULL,
    votedAt  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (pollId, userId),
    KEY idx_poll_votes_option (optionId),
    CONSTRAINT fk_poll_votes_poll FOREIGN KEY (pollId) REFERENCES polls (pollId) ON DELETE CASCADE,
    CONSTRAINT fk_poll_votes_option FOREIGN KEY (optionId) REFERENCES poll_options (optionId) ON DELETE CASCADE,
    CONSTRAINT fk_poll_votes_user FOREIGN KEY (userId) REFERENCES users (userId) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
