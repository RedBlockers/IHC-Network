ALTER TABLE users
    ADD COLUMN avatarDecoration VARCHAR(24) NOT NULL DEFAULT 'none' AFTER avatar;
