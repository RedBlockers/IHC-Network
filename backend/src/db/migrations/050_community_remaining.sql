ALTER TABLE guild_emojis
    MODIFY COLUMN kind ENUM('emoji','sticker','gif','sound') NOT NULL DEFAULT 'emoji';

CREATE TABLE guild_bots (
    botId       BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    guildId     BIGINT UNSIGNED NOT NULL,
    name        VARCHAR(80) NOT NULL,
    tokenHash   CHAR(64) NOT NULL,
    publicId    CHAR(24) NOT NULL,
    events      VARCHAR(400) NOT NULL DEFAULT 'message.created',
    createdBy   BIGINT UNSIGNED NOT NULL,
    createdAt   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    revokedAt   DATETIME(3) NULL,
    lastUsedAt  DATETIME(3) NULL,
    PRIMARY KEY (botId),
    UNIQUE KEY uq_bot_public (publicId),
    KEY idx_bots_guild (guildId, revokedAt),
    CONSTRAINT fk_bot_guild FOREIGN KEY (guildId) REFERENCES guilds (guildId) ON DELETE CASCADE,
    CONSTRAINT fk_bot_author FOREIGN KEY (createdBy) REFERENCES users (userId) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE bot_events (
    eventId     BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    botId       BIGINT UNSIGNED NOT NULL,
    type        VARCHAR(60) NOT NULL,
    payload     JSON NOT NULL,
    createdAt   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (eventId),
    KEY idx_bot_events (botId, eventId),
    CONSTRAINT fk_bot_event_bot FOREIGN KEY (botId) REFERENCES guild_bots (botId) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE guild_activities (
    activityId  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    guildId     BIGINT UNSIGNED NOT NULL,
    name        VARCHAR(80) NOT NULL,
    origin      VARCHAR(300) NOT NULL,
    createdBy   BIGINT UNSIGNED NOT NULL,
    createdAt   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (activityId),
    KEY idx_activities_guild (guildId),
    CONSTRAINT fk_activity_guild FOREIGN KEY (guildId) REFERENCES guilds (guildId) ON DELETE CASCADE,
    CONSTRAINT fk_activity_author FOREIGN KEY (createdBy) REFERENCES users (userId) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE guild_automations (
    automationId BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    guildId      BIGINT UNSIGNED NOT NULL,
    name         VARCHAR(80) NOT NULL,
    event        ENUM('message.created','member.joined') NOT NULL,
    action       ENUM('post_message','create_task') NOT NULL,
    channelId    BIGINT UNSIGNED NOT NULL,
    template     VARCHAR(500) NOT NULL DEFAULT '',
    enabled      TINYINT(1) NOT NULL DEFAULT 1,
    createdBy    BIGINT UNSIGNED NOT NULL,
    createdAt    DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (automationId),
    KEY idx_automations_guild (guildId, event, enabled),
    CONSTRAINT fk_auto_guild FOREIGN KEY (guildId) REFERENCES guilds (guildId) ON DELETE CASCADE,
    CONSTRAINT fk_auto_channel FOREIGN KEY (channelId) REFERENCES channels (channelId) ON DELETE CASCADE,
    CONSTRAINT fk_auto_author FOREIGN KEY (createdBy) REFERENCES users (userId) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE channel_whiteboard_strokes (
    strokeId    BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    channelId   BIGINT UNSIGNED NOT NULL,
    userId      BIGINT UNSIGNED NOT NULL,
    color       CHAR(7) NOT NULL,
    points      JSON NOT NULL,
    createdAt   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (strokeId),
    KEY idx_wb_channel (channelId, strokeId),
    CONSTRAINT fk_wb_channel FOREIGN KEY (channelId) REFERENCES channels (channelId) ON DELETE CASCADE,
    CONSTRAINT fk_wb_user FOREIGN KEY (userId) REFERENCES users (userId) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE channel_transcripts (
    transcriptId BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    channelId    BIGINT UNSIGNED NOT NULL,
    userId       BIGINT UNSIGNED NOT NULL,
    text         VARCHAR(4000) NOT NULL,
    consented    TINYINT(1) NOT NULL DEFAULT 1,
    createdAt    DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (transcriptId),
    KEY idx_transcripts_channel (channelId, createdAt),
    CONSTRAINT fk_tr_channel FOREIGN KEY (channelId) REFERENCES channels (channelId) ON DELETE CASCADE,
    CONSTRAINT fk_tr_user FOREIGN KEY (userId) REFERENCES users (userId) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE channel_summaries (
    summaryId   BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    channelId   BIGINT UNSIGNED NOT NULL,
    userId      BIGINT UNSIGNED NOT NULL,
    body        VARCHAR(4000) NOT NULL,
    createdAt   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (summaryId),
    KEY idx_summaries_channel (channelId, createdAt),
    CONSTRAINT fk_sum_channel FOREIGN KEY (channelId) REFERENCES channels (channelId) ON DELETE CASCADE,
    CONSTRAINT fk_sum_user FOREIGN KEY (userId) REFERENCES users (userId) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
