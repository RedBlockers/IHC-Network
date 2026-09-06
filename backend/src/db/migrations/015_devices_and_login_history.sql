ALTER TABLE user_sessions
    ADD COLUMN deviceLabel VARCHAR(120) NOT NULL DEFAULT '' AFTER userAgentHash;

CREATE TABLE login_history (
    entryId    BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    userId     BIGINT UNSIGNED NOT NULL,
    outcome    ENUM('success','failure') NOT NULL,
    deviceLabel VARCHAR(120) NOT NULL DEFAULT '',
    ipHash     CHAR(64) NULL,
    createdAt  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (entryId),
    KEY idx_login_history_user (userId, createdAt DESC),
    CONSTRAINT fk_login_history_user FOREIGN KEY (userId) REFERENCES users (userId) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
