CREATE TABLE notification_settings (
    userId    BIGINT UNSIGNED NOT NULL,
    scope     ENUM('guild','channel') NOT NULL,
    targetId  BIGINT UNSIGNED NOT NULL,
    level     ENUM('all','mentions','none','inherit') NOT NULL DEFAULT 'inherit',
    updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (userId, scope, targetId),
    CONSTRAINT fk_notif_settings_user FOREIGN KEY (userId) REFERENCES users (userId) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

ALTER TABLE users
    ADD COLUMN quietHoursStart TINYINT UNSIGNED NULL AFTER bannerBehaviour,
    ADD COLUMN quietHoursEnd   TINYINT UNSIGNED NULL AFTER quietHoursStart,
    ADD COLUMN desktopNotifications TINYINT(1) NOT NULL DEFAULT 1 AFTER quietHoursEnd;

CREATE TABLE channel_read_state (
    userId            BIGINT UNSIGNED NOT NULL,
    channelId         BIGINT UNSIGNED NOT NULL,
    lastReadMessageId BIGINT UNSIGNED NOT NULL DEFAULT 0,
    updatedAt         DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (userId, channelId),
    KEY idx_read_state_channel (channelId),
    CONSTRAINT fk_read_state_user FOREIGN KEY (userId) REFERENCES users (userId) ON DELETE CASCADE,
    CONSTRAINT fk_read_state_channel FOREIGN KEY (channelId) REFERENCES channels (channelId) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
