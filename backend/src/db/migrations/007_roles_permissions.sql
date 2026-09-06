CREATE TABLE guild_roles (
    roleId      BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    guildId     BIGINT UNSIGNED NOT NULL,
    name        VARCHAR(50) NOT NULL,
    iconEmoji   VARCHAR(32) NULL,
    color       CHAR(7) NOT NULL DEFAULT '#8895A5',
    position    INT UNSIGNED NOT NULL DEFAULT 0,
    isDefault   TINYINT(1) NOT NULL DEFAULT 0,
    isManaged   TINYINT(1) NOT NULL DEFAULT 0,
    mentionable TINYINT(1) NOT NULL DEFAULT 0,
    createdAt   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updatedAt   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (roleId),
    UNIQUE KEY uq_guild_role_name (guildId, name),
    KEY idx_guild_roles_position (guildId, position),
    CONSTRAINT fk_guild_roles_guild FOREIGN KEY (guildId) REFERENCES guilds (guildId) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE guild_role_permissions (
    roleId     BIGINT UNSIGNED NOT NULL,
    permission VARCHAR(64) NOT NULL,
    effect     ENUM('allow','deny') NOT NULL,
    PRIMARY KEY (roleId, permission),
    CONSTRAINT fk_role_permissions_role FOREIGN KEY (roleId) REFERENCES guild_roles (roleId) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE guild_member_roles (
    guildId    BIGINT UNSIGNED NOT NULL,
    userId     BIGINT UNSIGNED NOT NULL,
    roleId     BIGINT UNSIGNED NOT NULL,
    assignedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (guildId, userId, roleId),
    KEY idx_member_roles_role (roleId),
    CONSTRAINT fk_member_roles_member FOREIGN KEY (guildId, userId) REFERENCES guild_members (guildId, userId) ON DELETE CASCADE,
    CONSTRAINT fk_member_roles_role FOREIGN KEY (roleId) REFERENCES guild_roles (roleId) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE channel_permission_overrides (
    channelId  BIGINT UNSIGNED NOT NULL,
    targetType ENUM('role','member') NOT NULL,
    targetId   BIGINT UNSIGNED NOT NULL,
    permission VARCHAR(64) NOT NULL,
    effect     ENUM('allow','deny') NOT NULL,
    PRIMARY KEY (channelId, targetType, targetId, permission),
    KEY idx_channel_overrides_target (targetType, targetId),
    CONSTRAINT fk_channel_overrides_channel FOREIGN KEY (channelId) REFERENCES channels (channelId) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO guild_roles (guildId, name, color, position, isDefault, isManaged)
SELECT guildId, '@everyone', '#8895A5', 0, 1, 1 FROM guilds;

INSERT INTO guild_roles (guildId, name, iconEmoji, color, position, isManaged)
SELECT guildId, 'Administration', '🛡️', '#E3B34F', 900, 0 FROM guilds;

INSERT INTO guild_roles (guildId, name, iconEmoji, color, position, isManaged)
SELECT guildId, 'Propriétaire', '♛', '#D9A441', 1000, 1 FROM guilds;

INSERT INTO guild_member_roles (guildId, userId, roleId)
SELECT gm.guildId, gm.userId, gr.roleId
FROM guild_members gm JOIN guild_roles gr ON gr.guildId = gm.guildId AND gr.isDefault = 1;

INSERT INTO guild_member_roles (guildId, userId, roleId)
SELECT gm.guildId, gm.userId, gr.roleId
FROM guild_members gm JOIN guild_roles gr ON gr.guildId = gm.guildId AND gr.name = 'Administration'
WHERE gm.role = 'admin';

INSERT INTO guild_member_roles (guildId, userId, roleId)
SELECT gm.guildId, gm.userId, gr.roleId
FROM guild_members gm JOIN guild_roles gr ON gr.guildId = gm.guildId AND gr.name = 'Propriétaire'
WHERE gm.role = 'owner';

INSERT INTO guild_role_permissions (roleId, permission, effect)
SELECT roleId, permission, 'allow'
FROM guild_roles
CROSS JOIN (
    SELECT 'VIEW_CHANNEL' permission UNION ALL SELECT 'SEND_MESSAGES' UNION ALL SELECT 'READ_MESSAGE_HISTORY'
    UNION ALL SELECT 'ADD_REACTIONS' UNION ALL SELECT 'CREATE_INVITE' UNION ALL SELECT 'CONNECT'
    UNION ALL SELECT 'SPEAK' UNION ALL SELECT 'VIDEO' UNION ALL SELECT 'STREAM'
) base
WHERE guild_roles.isDefault = 1;

INSERT INTO guild_role_permissions (roleId, permission, effect)
SELECT roleId, permission, 'allow'
FROM guild_roles
CROSS JOIN (
    SELECT 'VIEW_CHANNEL' permission UNION ALL SELECT 'SEND_MESSAGES' UNION ALL SELECT 'READ_MESSAGE_HISTORY'
    UNION ALL SELECT 'ADD_REACTIONS' UNION ALL SELECT 'MENTION_EVERYONE' UNION ALL SELECT 'MANAGE_MESSAGES'
    UNION ALL SELECT 'CREATE_INVITE' UNION ALL SELECT 'CONNECT' UNION ALL SELECT 'SPEAK'
    UNION ALL SELECT 'VIDEO' UNION ALL SELECT 'STREAM' UNION ALL SELECT 'MUTE_MEMBERS'
    UNION ALL SELECT 'MOVE_MEMBERS' UNION ALL SELECT 'MANAGE_CHANNELS' UNION ALL SELECT 'MANAGE_ROLES'
    UNION ALL SELECT 'MANAGE_EMOJIS'
    UNION ALL SELECT 'MANAGE_WEBHOOKS' UNION ALL SELECT 'MODERATE_MEMBERS' UNION ALL SELECT 'KICK_MEMBERS'
    UNION ALL SELECT 'BAN_MEMBERS' UNION ALL SELECT 'VIEW_AUDIT_LOG'
) admin_permissions
WHERE guild_roles.name = 'Administration';
