CREATE TABLE message_attachments (
    attachmentId BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    channelId    BIGINT UNSIGNED NOT NULL,
    messageId    BIGINT UNSIGNED NULL,
    userId       BIGINT UNSIGNED NOT NULL,
    name         VARCHAR(255) NOT NULL,
    mime         VARCHAR(160) NOT NULL,
    bytes        BIGINT UNSIGNED NOT NULL,
    storageKey   VARCHAR(512) NOT NULL,
    url          VARCHAR(1024) NOT NULL,
    width        INT UNSIGNED NULL,
    height       INT UNSIGNED NULL,
    path         VARCHAR(512) NOT NULL DEFAULT '',
    version      INT UNSIGNED NOT NULL DEFAULT 1,
    replacesId   BIGINT UNSIGNED NULL,
    createdAt    DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (attachmentId),
    KEY idx_attachments_message (messageId),
    KEY idx_attachments_channel (channelId, createdAt DESC),
    KEY idx_attachments_lineage (channelId, name, version),
    CONSTRAINT fk_attachments_channel FOREIGN KEY (channelId) REFERENCES channels (channelId) ON DELETE CASCADE,
    CONSTRAINT fk_attachments_message FOREIGN KEY (messageId) REFERENCES messages (messageId) ON DELETE CASCADE,
    CONSTRAINT fk_attachments_user FOREIGN KEY (userId) REFERENCES users (userId) ON DELETE CASCADE,
    CONSTRAINT fk_attachments_replaces FOREIGN KEY (replacesId) REFERENCES message_attachments (attachmentId) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

ALTER TABLE channels
    MODIFY COLUMN type ENUM(
        'text','voice','announcement','forum','poll','event','ticket','task',
        'wiki','documentation','resources','faq','gallery'
    ) NOT NULL DEFAULT 'text';
