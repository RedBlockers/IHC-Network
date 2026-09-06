CREATE TABLE channel_worktrees (
    worktreeId  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    channelId   BIGINT UNSIGNED NOT NULL,
    guildId     BIGINT UNSIGNED NOT NULL,
    name        VARCHAR(80) NOT NULL,
    baseBranch  VARCHAR(120) NOT NULL DEFAULT 'main',
    headBranch  VARCHAR(120) NOT NULL DEFAULT 'main',
    headSha     CHAR(40) NULL,
    dirty       TINYINT(1) NOT NULL DEFAULT 0,
    status      ENUM('idle','active','review','merged','archived') NOT NULL DEFAULT 'idle',
    createdBy   BIGINT UNSIGNED NOT NULL,
    createdAt   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updatedAt   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (worktreeId),
    UNIQUE KEY uq_worktree_name (channelId, name),
    KEY idx_worktree_channel (channelId, status),
    CONSTRAINT fk_worktree_channel FOREIGN KEY (channelId) REFERENCES channels (channelId) ON DELETE CASCADE,
    CONSTRAINT fk_worktree_guild FOREIGN KEY (guildId) REFERENCES guilds (guildId) ON DELETE CASCADE,
    CONSTRAINT fk_worktree_author FOREIGN KEY (createdBy) REFERENCES users (userId) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE worktree_members (
    worktreeId      BIGINT UNSIGNED NOT NULL,
    userId          BIGINT UNSIGNED NOT NULL,
    role            ENUM('owner','pair','mob','reviewer') NOT NULL DEFAULT 'pair',
    consentTerminal TINYINT(1) NOT NULL DEFAULT 0,
    lastSeenAt      DATETIME(3) NULL,
    joinedAt        DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (worktreeId, userId),
    CONSTRAINT fk_wt_member_tree FOREIGN KEY (worktreeId) REFERENCES channel_worktrees (worktreeId) ON DELETE CASCADE,
    CONSTRAINT fk_wt_member_user FOREIGN KEY (userId) REFERENCES users (userId) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE worktree_commits (
    commitId      BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    worktreeId    BIGINT UNSIGNED NOT NULL,
    sha           CHAR(40) NOT NULL,
    subject       VARCHAR(200) NOT NULL,
    authorHandle  VARCHAR(32) NOT NULL,
    committedAt   DATETIME(3) NOT NULL,
    PRIMARY KEY (commitId),
    UNIQUE KEY uq_worktree_sha (worktreeId, sha),
    KEY idx_worktree_commits (worktreeId, committedAt),
    CONSTRAINT fk_wt_commit_tree FOREIGN KEY (worktreeId) REFERENCES channel_worktrees (worktreeId) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE worktree_files (
    fileId      BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    worktreeId  BIGINT UNSIGNED NOT NULL,
    path        VARCHAR(500) NOT NULL,
    status      ENUM('clean','modified','added','deleted') NOT NULL,
    language    VARCHAR(40) NULL,
    patch       MEDIUMTEXT NULL,
    PRIMARY KEY (fileId),
    UNIQUE KEY uq_worktree_path (worktreeId, path),
    CONSTRAINT fk_wt_file_tree FOREIGN KEY (worktreeId) REFERENCES channel_worktrees (worktreeId) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE worktree_reviews (
    reviewId    BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    worktreeId  BIGINT UNSIGNED NOT NULL,
    channelId   BIGINT UNSIGNED NOT NULL,
    title       VARCHAR(160) NOT NULL,
    baseSha     CHAR(40) NOT NULL,
    headSha     CHAR(40) NOT NULL,
    status      ENUM('open','approved','merged','closed') NOT NULL DEFAULT 'open',
    createdBy   BIGINT UNSIGNED NOT NULL,
    createdAt   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (reviewId),
    KEY idx_worktree_reviews (worktreeId, status),
    CONSTRAINT fk_wt_review_tree FOREIGN KEY (worktreeId) REFERENCES channel_worktrees (worktreeId) ON DELETE CASCADE,
    CONSTRAINT fk_wt_review_author FOREIGN KEY (createdBy) REFERENCES users (userId) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE worktree_review_comments (
    commentId   BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    reviewId    BIGINT UNSIGNED NOT NULL,
    path        VARCHAR(500) NOT NULL,
    lineStart   INT UNSIGNED NOT NULL,
    lineEnd     INT UNSIGNED NOT NULL,
    body        VARCHAR(2000) NOT NULL,
    authorId    BIGINT UNSIGNED NOT NULL,
    createdAt   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (commentId),
    KEY idx_review_comments (reviewId),
    CONSTRAINT fk_wt_comment_review FOREIGN KEY (reviewId) REFERENCES worktree_reviews (reviewId) ON DELETE CASCADE,
    CONSTRAINT fk_wt_comment_author FOREIGN KEY (authorId) REFERENCES users (userId) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE worktree_pipelines (
    pipelineId  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    worktreeId  BIGINT UNSIGNED NOT NULL,
    name        VARCHAR(80) NOT NULL,
    status      ENUM('queued','running','passed','failed') NOT NULL,
    logExcerpt  VARCHAR(2000) NOT NULL DEFAULT '',
    startedAt   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    finishedAt  DATETIME(3) NULL,
    PRIMARY KEY (pipelineId),
    KEY idx_worktree_pipelines (worktreeId, startedAt),
    CONSTRAINT fk_wt_pipeline_tree FOREIGN KEY (worktreeId) REFERENCES channel_worktrees (worktreeId) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE worktree_decisions (
    decisionId  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    worktreeId  BIGINT UNSIGNED NOT NULL,
    title       VARCHAR(160) NOT NULL,
    body        VARCHAR(4000) NOT NULL,
    createdBy   BIGINT UNSIGNED NOT NULL,
    createdAt   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (decisionId),
    KEY idx_worktree_decisions (worktreeId, createdAt),
    CONSTRAINT fk_wt_decision_tree FOREIGN KEY (worktreeId) REFERENCES channel_worktrees (worktreeId) ON DELETE CASCADE,
    CONSTRAINT fk_wt_decision_author FOREIGN KEY (createdBy) REFERENCES users (userId) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE worktree_terminals (
    sessionId  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    worktreeId BIGINT UNSIGNED NOT NULL,
    openedBy   BIGINT UNSIGNED NOT NULL,
    status     ENUM('pending','open','closed') NOT NULL DEFAULT 'pending',
    createdAt  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (sessionId),
    KEY idx_worktree_terminals (worktreeId, status),
    CONSTRAINT fk_wt_term_tree FOREIGN KEY (worktreeId) REFERENCES channel_worktrees (worktreeId) ON DELETE CASCADE,
    CONSTRAINT fk_wt_term_author FOREIGN KEY (openedBy) REFERENCES users (userId) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE worktree_cursors (
    worktreeId    BIGINT UNSIGNED NOT NULL,
    userId        BIGINT UNSIGNED NOT NULL,
    path          VARCHAR(500) NOT NULL,
    lineNo        INT UNSIGNED NOT NULL,
    columnOffset  INT UNSIGNED NOT NULL DEFAULT 0,
    updatedAt     DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (worktreeId, userId),
    CONSTRAINT fk_wt_cursor_tree FOREIGN KEY (worktreeId) REFERENCES channel_worktrees (worktreeId) ON DELETE CASCADE,
    CONSTRAINT fk_wt_cursor_user FOREIGN KEY (userId) REFERENCES users (userId) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
