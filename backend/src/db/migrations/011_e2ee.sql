CREATE TABLE e2ee_devices (
    deviceId    BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    userId      BIGINT UNSIGNED NOT NULL,
    publicKey   VARBINARY(32) NOT NULL,
    fingerprint CHAR(64) NOT NULL,
    label       VARCHAR(60) NOT NULL DEFAULT '',
    createdAt   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    lastSeenAt  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    revokedAt   DATETIME NULL,
    PRIMARY KEY (deviceId),
    UNIQUE KEY uq_devices_fingerprint (fingerprint),
    KEY idx_devices_user (userId, revokedAt),
    CONSTRAINT fk_devices_user FOREIGN KEY (userId) REFERENCES users (userId) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE channel_key_epochs (
    epochId            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    channelId          BIGINT UNSIGNED NOT NULL,
    epoch              INT UNSIGNED NOT NULL,
    createdBy          BIGINT UNSIGNED NOT NULL,
    createdByDeviceId  BIGINT UNSIGNED NOT NULL,
    ephemeralPublicKey VARBINARY(32) NOT NULL,
    algorithm          VARCHAR(64) NOT NULL DEFAULT 'x25519-hkdf-sha256/aes-256-gcm',
    createdAt          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (epochId),
    UNIQUE KEY uq_epochs_channel (channelId, epoch),
    KEY idx_epochs_channel (channelId, epoch DESC),
    CONSTRAINT fk_epochs_channel FOREIGN KEY (channelId) REFERENCES channels (channelId) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE channel_key_shares (
    epochId    BIGINT UNSIGNED NOT NULL,
    deviceId   BIGINT UNSIGNED NOT NULL,
    wrappedKey VARBINARY(192) NOT NULL,
    PRIMARY KEY (epochId, deviceId),
    KEY idx_shares_device (deviceId),
    CONSTRAINT fk_shares_epoch FOREIGN KEY (epochId) REFERENCES channel_key_epochs (epochId) ON DELETE CASCADE,
    CONSTRAINT fk_shares_device FOREIGN KEY (deviceId) REFERENCES e2ee_devices (deviceId) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

ALTER TABLE channels
    ADD COLUMN e2eeEnabled TINYINT(1) NOT NULL DEFAULT 0 AFTER position,
    ADD COLUMN keyEpoch INT UNSIGNED NOT NULL DEFAULT 0 AFTER e2eeEnabled;

ALTER TABLE messages
    ADD COLUMN encryptionEpoch INT UNSIGNED NULL AFTER content;
