ALTER TABLE channels
    ADD KEY idx_channels_order (guildId, categoryId, position, channelId);
