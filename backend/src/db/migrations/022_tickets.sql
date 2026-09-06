ALTER TABLE channels
    MODIFY COLUMN type ENUM('text','voice','announcement','forum','poll','event','ticket') NOT NULL DEFAULT 'text';

CREATE TABLE channel_tickets (
    ticketId   BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    channelId  BIGINT UNSIGNED NOT NULL,
    guildId    BIGINT UNSIGNED NOT NULL,
    number     INT UNSIGNED NOT NULL,
    title      VARCHAR(140) NOT NULL,
    status     ENUM('open','pending','resolved','closed') NOT NULL DEFAULT 'open',
    openedBy   BIGINT UNSIGNED NOT NULL,
    assigneeId BIGINT UNSIGNED NULL,
    createdAt  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updatedAt  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (ticketId),
    UNIQUE KEY uq_tickets_number (channelId, number),
    KEY idx_tickets_queue (channelId, status, updatedAt DESC),
    CONSTRAINT fk_tickets_channel FOREIGN KEY (channelId) REFERENCES channels (channelId) ON DELETE CASCADE,
    CONSTRAINT fk_tickets_guild FOREIGN KEY (guildId) REFERENCES guilds (guildId) ON DELETE CASCADE,
    CONSTRAINT fk_tickets_author FOREIGN KEY (openedBy) REFERENCES users (userId) ON DELETE CASCADE,
    CONSTRAINT fk_tickets_assignee FOREIGN KEY (assigneeId) REFERENCES users (userId) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE ticket_messages (
    ticketMessageId BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    ticketId        BIGINT UNSIGNED NOT NULL,
    userId          BIGINT UNSIGNED NOT NULL,
    body            VARCHAR(3400) NOT NULL,
    internal        TINYINT(1) NOT NULL DEFAULT 0,
    createdAt       DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (ticketMessageId),
    KEY idx_ticket_messages_ticket (ticketId, ticketMessageId),
    CONSTRAINT fk_ticket_messages_ticket FOREIGN KEY (ticketId) REFERENCES channel_tickets (ticketId) ON DELETE CASCADE,
    CONSTRAINT fk_ticket_messages_user FOREIGN KEY (userId) REFERENCES users (userId) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
