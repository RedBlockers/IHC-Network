CREATE TABLE user_credentials (
    credentialId  VARBINARY(255)  NOT NULL,
    userId        BIGINT UNSIGNED NOT NULL,
    publicKey     VARBINARY(1024) NOT NULL,
    counter       BIGINT UNSIGNED NOT NULL DEFAULT 0,
    transports    VARCHAR(120)    NOT NULL DEFAULT '',
    label         VARCHAR(60)     NOT NULL,
    backedUp      TINYINT(1)      NOT NULL DEFAULT 0,
    createdAt     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    lastUsedAt    DATETIME        NULL,
    PRIMARY KEY (credentialId),
    KEY idx_credentials_user (userId, createdAt),
    CONSTRAINT fk_credentials_user FOREIGN KEY (userId) REFERENCES users (userId) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE webauthn_challenges (
    challenge  VARCHAR(255)    NOT NULL,
    userId     BIGINT UNSIGNED NULL,
    purpose    ENUM('register','login') NOT NULL,
    expiresAt  DATETIME        NOT NULL,
    PRIMARY KEY (challenge),
    KEY idx_challenges_expiry (expiresAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
