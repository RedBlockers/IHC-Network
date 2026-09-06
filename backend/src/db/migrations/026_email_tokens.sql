CREATE TABLE email_tokens (
    tokenId   BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    userId    BIGINT UNSIGNED NOT NULL,
    purpose   ENUM('verify','reset') NOT NULL,
    tokenHash CHAR(64) NOT NULL,
    email     VARCHAR(254) NOT NULL,
    expiresAt DATETIME NOT NULL,
    usedAt    DATETIME NULL,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (tokenId),
    UNIQUE KEY uq_email_tokens_hash (tokenHash),
    KEY idx_email_tokens_user (userId, purpose, usedAt),
    CONSTRAINT fk_email_tokens_user FOREIGN KEY (userId) REFERENCES users (userId) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
