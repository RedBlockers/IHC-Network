CREATE TABLE notifications (
    notificationId BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    userId         BIGINT UNSIGNED NOT NULL,
    actorId        BIGINT UNSIGNED NULL,
    type           ENUM('mention','reply','friend_request') NOT NULL,
    channelId      BIGINT UNSIGNED NULL,
    messageId      BIGINT UNSIGNED NULL,
    readAt         DATETIME(3) NULL,
    createdAt      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (notificationId),
    UNIQUE KEY uq_notification_message (userId, type, messageId),
    KEY idx_notifications_user_time (userId, createdAt),
    CONSTRAINT fk_notifications_user FOREIGN KEY (userId) REFERENCES users (userId) ON DELETE CASCADE,
    CONSTRAINT fk_notifications_actor FOREIGN KEY (actorId) REFERENCES users (userId) ON DELETE SET NULL,
    CONSTRAINT fk_notifications_channel FOREIGN KEY (channelId) REFERENCES channels (channelId) ON DELETE CASCADE,
    CONSTRAINT fk_notifications_message FOREIGN KEY (messageId) REFERENCES messages (messageId) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
