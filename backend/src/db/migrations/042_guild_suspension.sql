ALTER TABLE guilds
    ADD COLUMN suspendedAt     DATETIME     NULL AFTER createdAt,
    ADD COLUMN suspendedReason VARCHAR(300) NULL AFTER suspendedAt,
    ADD COLUMN suspendedBy     BIGINT UNSIGNED NULL AFTER suspendedReason;
