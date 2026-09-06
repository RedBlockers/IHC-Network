ALTER TABLE channels
    MODIFY COLUMN type ENUM('text','voice','announcement','forum','poll','event','ticket','task') NOT NULL DEFAULT 'text';

CREATE TABLE channel_tasks (
    taskId     BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    channelId  BIGINT UNSIGNED NOT NULL,
    guildId    BIGINT UNSIGNED NOT NULL,
    title      VARCHAR(160) NOT NULL,
    details    VARCHAR(2000) NOT NULL DEFAULT '',
    status     ENUM('todo','doing','done') NOT NULL DEFAULT 'todo',
    assigneeId BIGINT UNSIGNED NULL,
    dueAt      DATETIME NULL,
    position   INT UNSIGNED NOT NULL DEFAULT 0,
    createdBy  BIGINT UNSIGNED NOT NULL,
    createdAt  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updatedAt  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    completedAt DATETIME NULL,
    PRIMARY KEY (taskId),
    KEY idx_tasks_board (channelId, status, position),
    CONSTRAINT fk_tasks_channel FOREIGN KEY (channelId) REFERENCES channels (channelId) ON DELETE CASCADE,
    CONSTRAINT fk_tasks_guild FOREIGN KEY (guildId) REFERENCES guilds (guildId) ON DELETE CASCADE,
    CONSTRAINT fk_tasks_author FOREIGN KEY (createdBy) REFERENCES users (userId) ON DELETE CASCADE,
    CONSTRAINT fk_tasks_assignee FOREIGN KEY (assigneeId) REFERENCES users (userId) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
