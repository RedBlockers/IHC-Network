ALTER TABLE channels ADD COLUMN expiresAt DATETIME NULL;
ALTER TABLE message_threads ADD COLUMN resolvedAt DATETIME(3) NULL;
ALTER TABLE document_revisions ADD COLUMN title VARCHAR(160) NULL;
ALTER TABLE channel_tickets ADD COLUMN priority ENUM('low','normal','high','urgent') NOT NULL DEFAULT 'normal';

CREATE TABLE channel_access_requests (
    channelId BIGINT UNSIGNED NOT NULL,
    userId BIGINT UNSIGNED NOT NULL,
    status ENUM('pending','approved','declined') NOT NULL DEFAULT 'pending',
    reason VARCHAR(1000) NOT NULL DEFAULT '',
    reviewedBy BIGINT UNSIGNED NULL,
    createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (channelId, userId),
    CONSTRAINT fk_access_request_channel FOREIGN KEY (channelId) REFERENCES channels (channelId) ON DELETE CASCADE,
    CONSTRAINT fk_access_request_user FOREIGN KEY (userId) REFERENCES users (userId) ON DELETE CASCADE,
    CONSTRAINT fk_access_request_reviewer FOREIGN KEY (reviewedBy) REFERENCES users (userId) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

UPDATE messages m LEFT JOIN messages parent ON parent.messageId = m.threadRootId
SET m.threadRootId = NULL WHERE m.threadRootId IS NOT NULL AND parent.messageId IS NULL;
ALTER TABLE messages ADD CONSTRAINT fk_messages_thread_root
    FOREIGN KEY (threadRootId) REFERENCES messages (messageId) ON DELETE CASCADE;

INSERT IGNORE INTO channel_permission_overrides (channelId, targetType, targetId, permission, effect)
SELECT c.channelId, 'role', r.roleId, 'VIEW_CHANNEL', 'deny'
FROM channels c JOIN guild_roles r ON r.guildId = c.guildId AND r.isDefault = 1 WHERE c.type = 'gated';
UPDATE channels SET expiresAt = DATE_ADD(UTC_TIMESTAMP(), INTERVAL 1 DAY) WHERE type = 'ephemeral' AND expiresAt IS NULL;

INSERT IGNORE INTO channel_permission_overrides (channelId, targetType, targetId, permission, effect)
SELECT c.channelId, 'role', r.roleId, p.permission, 'deny'
FROM channels c JOIN guild_roles r ON r.guildId = c.guildId AND r.isDefault = 1
CROSS JOIN (SELECT 'SPEAK' permission UNION ALL SELECT 'VIDEO' UNION ALL SELECT 'STREAM') p
WHERE c.type = 'stage';
