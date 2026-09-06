ALTER TABLE users
    ADD COLUMN deletionRequestedAt DATETIME NULL AFTER hideReadChannels,
    ADD COLUMN policyVersion VARCHAR(20) NULL AFTER deletionRequestedAt,
    ADD COLUMN policyAcceptedAt DATETIME NULL AFTER policyVersion,
    ADD COLUMN suspensionReason VARCHAR(500) NULL AFTER bannedUntil;

CREATE INDEX idx_users_deletion ON users (deletionRequestedAt);
