ALTER TABLE users
    ADD COLUMN digestFrequency ENUM('off','daily','weekly') NOT NULL DEFAULT 'daily' AFTER desktopNotifications;
