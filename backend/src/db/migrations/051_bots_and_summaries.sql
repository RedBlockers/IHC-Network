ALTER TABLE messages
    ADD COLUMN botName VARCHAR(80) NULL AFTER webhookName;

ALTER TABLE channel_summaries
    ADD COLUMN method VARCHAR(32) NOT NULL DEFAULT 'extractive' AFTER body;
