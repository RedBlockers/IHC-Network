ALTER TABLE users
    ADD COLUMN themePreference ENUM('dark','light','oled','contrast','midnight') NOT NULL DEFAULT 'dark' AFTER activityText,
    ADD COLUMN densityPreference ENUM('comfortable','compact') NOT NULL DEFAULT 'comfortable' AFTER themePreference,
    ADD COLUMN accentPreference CHAR(7) NULL AFTER densityPreference,
    ADD COLUMN reduceMotion TINYINT(1) NOT NULL DEFAULT 0 AFTER accentPreference,
    ADD COLUMN highContrast TINYINT(1) NOT NULL DEFAULT 0 AFTER reduceMotion,
    ADD COLUMN hideBanners TINYINT(1) NOT NULL DEFAULT 0 AFTER highContrast,
    ADD COLUMN neutralizeCommunityThemes TINYINT(1) NOT NULL DEFAULT 0 AFTER hideBanners,
    ADD COLUMN bannerBehaviour ENUM('auto','fixed','compact') NOT NULL DEFAULT 'auto' AFTER neutralizeCommunityThemes;
