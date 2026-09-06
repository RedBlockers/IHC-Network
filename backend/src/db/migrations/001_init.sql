CREATE TABLE users (
    userId            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    handle            VARCHAR(20)  NOT NULL,
    displayName       VARCHAR(32)  NOT NULL,
    email             VARCHAR(254) NOT NULL,
    password          CHAR(60)     NOT NULL,
    avatar            VARCHAR(512) NOT NULL DEFAULT '/assets/default-avatar.png',
    aboutMe           VARCHAR(200) NOT NULL DEFAULT '',
    presence          ENUM('online','idle','busy','offline') NOT NULL DEFAULT 'offline',
    isBot             TINYINT(1)   NOT NULL DEFAULT 0,
    isEmailVerified   TINYINT(1)   NOT NULL DEFAULT 0,
    isBanned          TINYINT(1)   NOT NULL DEFAULT 0,
    bannedUntil       DATETIME     NULL,
    passwordUpdatedAt DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    createdAt         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (userId),
    UNIQUE KEY uq_users_handle (handle),
    UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE guilds (
    guildId          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    name             VARCHAR(50)  NOT NULL,
    description      VARCHAR(200) NOT NULL DEFAULT '',
    icon             VARCHAR(512) NULL,
    ownerId          BIGINT UNSIGNED NOT NULL,
    createdAt        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (guildId),
    KEY idx_guilds_owner (ownerId),
    CONSTRAINT fk_guilds_owner FOREIGN KEY (ownerId) REFERENCES users (userId) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE guild_members (
    guildId  BIGINT UNSIGNED NOT NULL,
    userId   BIGINT UNSIGNED NOT NULL,
    role     ENUM('owner','admin','member') NOT NULL DEFAULT 'member',
    joinedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (guildId, userId),
    KEY idx_members_user (userId),
    CONSTRAINT fk_members_guild FOREIGN KEY (guildId) REFERENCES guilds (guildId) ON DELETE CASCADE,
    CONSTRAINT fk_members_user  FOREIGN KEY (userId)  REFERENCES users  (userId) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE friendships (
    friendshipId BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    requesterId  BIGINT UNSIGNED NOT NULL,
    addresseeId  BIGINT UNSIGNED NOT NULL,
    userLow      BIGINT UNSIGNED AS (LEAST(requesterId, addresseeId)) STORED,
    userHigh     BIGINT UNSIGNED AS (GREATEST(requesterId, addresseeId)) STORED,
    status       ENUM('pending','accepted') NOT NULL DEFAULT 'pending',
    createdAt    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (friendshipId),
    UNIQUE KEY uq_friendship_pair (userLow, userHigh),
    KEY idx_friendship_requester (requesterId),
    KEY idx_friendship_addressee (addresseeId),
    CONSTRAINT fk_friend_requester FOREIGN KEY (requesterId) REFERENCES users (userId),
    CONSTRAINT fk_friend_addressee FOREIGN KEY (addresseeId) REFERENCES users (userId),
    CONSTRAINT ck_friend_distinct CHECK (requesterId <> addresseeId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE channels (
    channelId    BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    type         ENUM('text','voice') NOT NULL DEFAULT 'text',
    name         VARCHAR(50)  NOT NULL,
    description  VARCHAR(200) NOT NULL DEFAULT '',
    guildId      BIGINT UNSIGNED NULL,
    friendshipId BIGINT UNSIGNED NULL,
    position     INT UNSIGNED NOT NULL DEFAULT 0,
    createdAt    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (channelId),
    KEY idx_channels_guild (guildId),
    UNIQUE KEY uq_channels_friendship (friendshipId),
    CONSTRAINT fk_channels_guild  FOREIGN KEY (guildId)      REFERENCES guilds      (guildId)      ON DELETE CASCADE,
    CONSTRAINT fk_channels_friend FOREIGN KEY (friendshipId) REFERENCES friendships (friendshipId) ON DELETE CASCADE,
    CONSTRAINT ck_channels_owner CHECK (
        (guildId IS NOT NULL AND friendshipId IS NULL) OR
        (guildId IS NULL AND friendshipId IS NOT NULL)
    )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE messages (
    messageId BIGINT UNSIGNED NOT NULL,
    channelId BIGINT UNSIGNED NOT NULL,
    userId    BIGINT UNSIGNED NOT NULL,
    content   VARCHAR(2000) NOT NULL,
    createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    editedAt  DATETIME(3) NULL,
    PRIMARY KEY (messageId),
    KEY idx_messages_channel_id (channelId, messageId),
    KEY idx_messages_user (userId),
    CONSTRAINT fk_messages_channel FOREIGN KEY (channelId) REFERENCES channels (channelId) ON DELETE CASCADE,
    CONSTRAINT fk_messages_user    FOREIGN KEY (userId)    REFERENCES users    (userId)    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE invites (
    inviteId  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    code      CHAR(22) NOT NULL,
    guildId   BIGINT UNSIGNED NOT NULL,
    createdBy BIGINT UNSIGNED NOT NULL,
    maxUses   INT UNSIGNED NULL,
    uses      INT UNSIGNED NOT NULL DEFAULT 0,
    expiresAt DATETIME NULL,
    revokedAt DATETIME NULL,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (inviteId),
    UNIQUE KEY uq_invites_code (code),
    KEY idx_invites_guild (guildId),
    CONSTRAINT fk_invites_guild  FOREIGN KEY (guildId)   REFERENCES guilds (guildId) ON DELETE CASCADE,
    CONSTRAINT fk_invites_author FOREIGN KEY (createdBy) REFERENCES users  (userId)  ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE login_attempts (
    attemptId   BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    ip          VARCHAR(45) NOT NULL,
    handle      VARCHAR(20) NULL,
    attemptedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (attemptId),
    KEY idx_attempts_ip_time (ip, attemptedAt),
    KEY idx_attempts_time (attemptedAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
