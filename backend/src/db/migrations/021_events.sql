ALTER TABLE channels
    MODIFY COLUMN type ENUM('text','voice','announcement','forum','poll','event') NOT NULL DEFAULT 'text';

CREATE TABLE channel_events (
    eventId     BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    channelId   BIGINT UNSIGNED NOT NULL,
    guildId     BIGINT UNSIGNED NOT NULL,
    title       VARCHAR(120) NOT NULL,
    description VARCHAR(2000) NOT NULL DEFAULT '',
    location    VARCHAR(160) NOT NULL DEFAULT '',
    startsAt    DATETIME NOT NULL,
    endsAt      DATETIME NULL,
    createdBy   BIGINT UNSIGNED NOT NULL,
    cancelledAt DATETIME NULL,
    createdAt   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (eventId),
    KEY idx_events_channel (channelId, startsAt),
    CONSTRAINT fk_events_channel FOREIGN KEY (channelId) REFERENCES channels (channelId) ON DELETE CASCADE,
    CONSTRAINT fk_events_guild FOREIGN KEY (guildId) REFERENCES guilds (guildId) ON DELETE CASCADE,
    CONSTRAINT fk_events_author FOREIGN KEY (createdBy) REFERENCES users (userId) ON DELETE CASCADE,
    CONSTRAINT ck_events_dates CHECK (endsAt IS NULL OR endsAt > startsAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE event_participants (
    eventId    BIGINT UNSIGNED NOT NULL,
    userId     BIGINT UNSIGNED NOT NULL,
    response   ENUM('going','maybe','no') NOT NULL,
    respondedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (eventId, userId),
    KEY idx_event_participants_event (eventId, response),
    CONSTRAINT fk_event_participants_event FOREIGN KEY (eventId) REFERENCES channel_events (eventId) ON DELETE CASCADE,
    CONSTRAINT fk_event_participants_user FOREIGN KEY (userId) REFERENCES users (userId) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
