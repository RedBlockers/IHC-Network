ALTER TABLE channels
    MODIFY COLUMN type ENUM(
        'text','voice','announcement','forum','poll','event','ticket','task',
        'wiki','documentation','resources','faq'
    ) NOT NULL DEFAULT 'text';

CREATE TABLE channel_documents (
    documentId BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    channelId  BIGINT UNSIGNED NOT NULL,
    guildId    BIGINT UNSIGNED NOT NULL,
    title      VARCHAR(160) NOT NULL,
    position   INT UNSIGNED NOT NULL DEFAULT 0,
    createdBy  BIGINT UNSIGNED NOT NULL,
    updatedBy  BIGINT UNSIGNED NOT NULL,
    createdAt  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updatedAt  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (documentId),
    KEY idx_documents_channel (channelId, position, documentId),
    CONSTRAINT fk_documents_channel FOREIGN KEY (channelId) REFERENCES channels (channelId) ON DELETE CASCADE,
    CONSTRAINT fk_documents_guild FOREIGN KEY (guildId) REFERENCES guilds (guildId) ON DELETE CASCADE,
    CONSTRAINT fk_documents_author FOREIGN KEY (createdBy) REFERENCES users (userId) ON DELETE CASCADE,
    CONSTRAINT fk_documents_editor FOREIGN KEY (updatedBy) REFERENCES users (userId) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE document_revisions (
    revisionId BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    documentId BIGINT UNSIGNED NOT NULL,
    body       MEDIUMTEXT NOT NULL,
    summary    VARCHAR(200) NOT NULL DEFAULT '',
    editedBy   BIGINT UNSIGNED NOT NULL,
    editedAt   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (revisionId),
    KEY idx_revisions_document (documentId, revisionId DESC),
    CONSTRAINT fk_revisions_document FOREIGN KEY (documentId) REFERENCES channel_documents (documentId) ON DELETE CASCADE,
    CONSTRAINT fk_revisions_editor FOREIGN KEY (editedBy) REFERENCES users (userId) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
