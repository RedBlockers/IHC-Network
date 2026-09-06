CREATE TABLE user_activity (
    userId    BIGINT UNSIGNED NOT NULL,
    kind      ENUM('playing','listening','editing','reviewing','meeting','custom') NOT NULL,
    name      VARCHAR(80) NOT NULL,
    detail    VARCHAR(120) NULL,
    context   VARCHAR(160) NULL,
    startedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expiresAt DATETIME NOT NULL,
    PRIMARY KEY (userId),
    KEY idx_activity_expiry (expiresAt),
    CONSTRAINT fk_activity_user FOREIGN KEY (userId) REFERENCES users (userId) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

ALTER TABLE users
    ADD COLUMN presenceVisibility ENUM('everyone','friends','nobody') NOT NULL DEFAULT 'everyone' AFTER statusPreference,
    ADD COLUMN activityVisibility ENUM('everyone','friends','nobody') NOT NULL DEFAULT 'everyone' AFTER presenceVisibility;

CREATE TABLE guild_profiles (
    guildId     BIGINT UNSIGNED NOT NULL,
    userId      BIGINT UNSIGNED NOT NULL,
    displayName VARCHAR(32) NULL,
    aboutMe     VARCHAR(200) NULL,
    avatar      VARCHAR(500) NULL,
    PRIMARY KEY (guildId, userId),
    CONSTRAINT fk_guild_profile_guild FOREIGN KEY (guildId) REFERENCES guilds (guildId) ON DELETE CASCADE,
    CONSTRAINT fk_guild_profile_user  FOREIGN KEY (userId)  REFERENCES users  (userId)  ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
