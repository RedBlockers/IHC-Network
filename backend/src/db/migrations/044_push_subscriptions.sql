CREATE TABLE push_subscriptions (
    subscriptionId BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    userId         BIGINT UNSIGNED NOT NULL,
    endpoint       TEXT            NOT NULL,
    endpointHash   CHAR(64)        NOT NULL,
    p256dh         VARCHAR(255)    NOT NULL,
    auth           VARCHAR(255)    NOT NULL,
    deviceLabel    VARCHAR(120)    NOT NULL DEFAULT '',
    createdAt      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    lastSentAt     DATETIME        NULL,
    failures       INT UNSIGNED    NOT NULL DEFAULT 0,
    PRIMARY KEY (subscriptionId),
    UNIQUE KEY uq_push_endpoint (endpointHash),
    KEY idx_push_user (userId),
    CONSTRAINT fk_push_user FOREIGN KEY (userId) REFERENCES users (userId) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
