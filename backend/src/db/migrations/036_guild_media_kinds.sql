ALTER TABLE guild_emojis
    ADD COLUMN kind ENUM('emoji','sticker','gif') NOT NULL DEFAULT 'emoji' AFTER guildId,
    ADD COLUMN bytes INT UNSIGNED NOT NULL DEFAULT 0 AFTER url;

ALTER TABLE guild_emojis
    DROP INDEX uq_guild_emoji_name,
    ADD UNIQUE KEY uq_guild_media_name (guildId, kind, name);
