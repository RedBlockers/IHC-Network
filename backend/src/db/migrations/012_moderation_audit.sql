CREATE TABLE guild_sanctions (
    sanctionId BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    guildId    BIGINT UNSIGNED NOT NULL,
    userId     BIGINT UNSIGNED NOT NULL,
    type       ENUM('kick','ban','timeout') NOT NULL,
    reason     VARCHAR(500) NOT NULL,
    issuedBy   BIGINT UNSIGNED NOT NULL,
    issuedAt   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expiresAt  DATETIME NULL,
    revokedAt  DATETIME NULL,
    revokedBy  BIGINT UNSIGNED NULL,
    revokeReason VARCHAR(500) NULL,
    appealText VARCHAR(1000) NULL,
    appealedAt DATETIME NULL,
    PRIMARY KEY (sanctionId),
    KEY idx_sanctions_guild_user (guildId, userId, revokedAt),
    KEY idx_sanctions_active (guildId, type, revokedAt, expiresAt),
    CONSTRAINT fk_sanctions_guild FOREIGN KEY (guildId) REFERENCES guilds (guildId) ON DELETE CASCADE,
    CONSTRAINT fk_sanctions_user FOREIGN KEY (userId) REFERENCES users (userId) ON DELETE CASCADE,
    CONSTRAINT fk_sanctions_issuer FOREIGN KEY (issuedBy) REFERENCES users (userId) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE guild_audit_log (
    entryId    BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    guildId    BIGINT UNSIGNED NOT NULL,
    actorId    BIGINT UNSIGNED NULL,
    action     VARCHAR(60) NOT NULL,
    targetType ENUM('user','role','channel','guild','message','sanction') NOT NULL,
    targetId   VARCHAR(40) NULL,
    reason     VARCHAR(500) NULL,
    createdAt  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (entryId),
    KEY idx_audit_guild_time (guildId, createdAt DESC),
    KEY idx_audit_guild_action (guildId, action),
    CONSTRAINT fk_audit_guild FOREIGN KEY (guildId) REFERENCES guilds (guildId) ON DELETE CASCADE,
    CONSTRAINT fk_audit_actor FOREIGN KEY (actorId) REFERENCES users (userId) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE moderation_notes (
    noteId    BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    guildId   BIGINT UNSIGNED NOT NULL,
    userId    BIGINT UNSIGNED NOT NULL,
    authorId  BIGINT UNSIGNED NOT NULL,
    body      VARCHAR(1000) NOT NULL,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (noteId),
    KEY idx_notes_guild_user (guildId, userId, createdAt),
    CONSTRAINT fk_notes_guild FOREIGN KEY (guildId) REFERENCES guilds (guildId) ON DELETE CASCADE,
    CONSTRAINT fk_notes_user FOREIGN KEY (userId) REFERENCES users (userId) ON DELETE CASCADE,
    CONSTRAINT fk_notes_author FOREIGN KEY (authorId) REFERENCES users (userId) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

ALTER TABLE notifications
    MODIFY COLUMN type ENUM('mention','reply','friend_request','sanction') NOT NULL;
