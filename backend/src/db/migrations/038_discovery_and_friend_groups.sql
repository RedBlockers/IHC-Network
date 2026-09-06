ALTER TABLE guilds
    ADD COLUMN isDiscoverable TINYINT(1) NOT NULL DEFAULT 0 AFTER accent,
    ADD COLUMN discoveryPitch VARCHAR(280) NULL AFTER isDiscoverable,
    ADD COLUMN discoveryTags VARCHAR(200) NULL AFTER discoveryPitch;

CREATE INDEX idx_guilds_discoverable ON guilds (isDiscoverable, guildId);

CREATE TABLE friend_groups (
    groupId   BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    userId    BIGINT UNSIGNED NOT NULL,
    name      VARCHAR(40) NOT NULL,
    position  INT UNSIGNED NOT NULL DEFAULT 0,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (groupId),
    KEY idx_friend_groups_user (userId, position, groupId),
    CONSTRAINT fk_friend_groups_user FOREIGN KEY (userId) REFERENCES users (userId) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE friend_group_members (
    groupId  BIGINT UNSIGNED NOT NULL,
    userId   BIGINT UNSIGNED NOT NULL,
    friendId BIGINT UNSIGNED NOT NULL,
    PRIMARY KEY (groupId, friendId),
    KEY idx_friend_group_owner (userId),
    CONSTRAINT fk_fgm_group  FOREIGN KEY (groupId)  REFERENCES friend_groups (groupId) ON DELETE CASCADE,
    CONSTRAINT fk_fgm_owner  FOREIGN KEY (userId)   REFERENCES users (userId) ON DELETE CASCADE,
    CONSTRAINT fk_fgm_friend FOREIGN KEY (friendId) REFERENCES users (userId) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
