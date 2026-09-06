CREATE TABLE personal_access_tokens (
    tokenId    BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    userId     BIGINT UNSIGNED NOT NULL,
    label      VARCHAR(80)     NOT NULL,
    prefix     CHAR(12)        NOT NULL,
    tokenHash  CHAR(64)        NOT NULL,
    createdAt  DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    lastUsedAt DATETIME(3)     NULL,
    expiresAt  DATETIME(3)     NULL,
    revokedAt  DATETIME(3)     NULL,
    PRIMARY KEY (tokenId),
    UNIQUE KEY uq_access_token_hash (tokenHash),
    KEY idx_access_token_user (userId, revokedAt),
    CONSTRAINT fk_access_token_user FOREIGN KEY (userId) REFERENCES users (userId) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE worktree_terminal_chunks (
    chunkId    BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    sessionId  BIGINT UNSIGNED NOT NULL,
    userId     BIGINT UNSIGNED NOT NULL,
    direction  ENUM('input','output') NOT NULL DEFAULT 'input',
    data       VARCHAR(4000)   NOT NULL,
    createdAt  DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (chunkId),
    KEY idx_terminal_chunks (sessionId, chunkId),
    CONSTRAINT fk_terminal_chunk_session FOREIGN KEY (sessionId) REFERENCES worktree_terminals (sessionId) ON DELETE CASCADE,
    CONSTRAINT fk_terminal_chunk_user FOREIGN KEY (userId) REFERENCES users (userId) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
