CREATE TABLE guild_onboarding (
    guildId           BIGINT UNSIGNED NOT NULL,
    enabled           TINYINT(1) NOT NULL DEFAULT 0,
    rules             TEXT NOT NULL,
    quarantineMinutes INT UNSIGNED NOT NULL DEFAULT 0,
    updatedAt         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (guildId),
    CONSTRAINT fk_onboarding_guild FOREIGN KEY (guildId) REFERENCES guilds (guildId) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE guild_onboarding_questions (
    questionId BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    guildId    BIGINT UNSIGNED NOT NULL,
    prompt     VARCHAR(200) NOT NULL,
    position   INT UNSIGNED NOT NULL DEFAULT 0,
    PRIMARY KEY (questionId),
    KEY idx_onboarding_questions_guild (guildId, position),
    CONSTRAINT fk_onboarding_questions_guild FOREIGN KEY (guildId) REFERENCES guilds (guildId) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE guild_onboarding_options (
    optionId   BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    questionId BIGINT UNSIGNED NOT NULL,
    label      VARCHAR(80) NOT NULL,
    roleId     BIGINT UNSIGNED NULL,
    position   INT UNSIGNED NOT NULL DEFAULT 0,
    PRIMARY KEY (optionId),
    KEY idx_onboarding_options_question (questionId, position),
    CONSTRAINT fk_onboarding_options_question FOREIGN KEY (questionId) REFERENCES guild_onboarding_questions (questionId) ON DELETE CASCADE,
    CONSTRAINT fk_onboarding_options_role FOREIGN KEY (roleId) REFERENCES guild_roles (roleId) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE guild_onboarding_completions (
    guildId    BIGINT UNSIGNED NOT NULL,
    userId     BIGINT UNSIGNED NOT NULL,
    acceptedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (guildId, userId),
    CONSTRAINT fk_onboarding_completions_guild FOREIGN KEY (guildId) REFERENCES guilds (guildId) ON DELETE CASCADE,
    CONSTRAINT fk_onboarding_completions_user FOREIGN KEY (userId) REFERENCES users (userId) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
