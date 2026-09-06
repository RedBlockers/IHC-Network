ALTER TABLE users MODIFY password VARCHAR(255) NOT NULL;

CREATE TABLE user_sessions (
    sessionId     CHAR(36) NOT NULL,
    familyId      CHAR(36) NOT NULL,
    userId        BIGINT UNSIGNED NOT NULL,
    tokenHash     CHAR(64) NOT NULL,
    userAgentHash CHAR(64) NULL,
    expiresAt     DATETIME NOT NULL,
    revokedAt     DATETIME NULL,
    lastUsedAt    DATETIME NULL,
    createdAt     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (sessionId),
    UNIQUE KEY uq_sessions_token (tokenHash),
    KEY idx_sessions_user (userId),
    KEY idx_sessions_family (familyId),
    KEY idx_sessions_expiry (expiresAt),
    CONSTRAINT fk_sessions_user FOREIGN KEY (userId) REFERENCES users (userId) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
