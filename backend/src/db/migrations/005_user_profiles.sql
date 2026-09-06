ALTER TABLE users
    ADD COLUMN bannerImage VARCHAR(512) NULL AFTER avatar,
    ADD COLUMN statusPreference ENUM('online','idle','dnd','invisible') NOT NULL DEFAULT 'online' AFTER presence,
    ADD COLUMN activityText VARCHAR(80) NOT NULL DEFAULT '' AFTER statusPreference;
