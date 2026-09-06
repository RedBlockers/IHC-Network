ALTER TABLE e2ee_devices
    ADD COLUMN kemPublicKey VARBINARY(1184) NULL AFTER publicKey;

ALTER TABLE channel_key_shares
    ADD COLUMN kemCipherText VARBINARY(1088) NULL AFTER wrappedKey;

UPDATE channel_key_epochs
   SET algorithm = 'x25519-hkdf-sha256/aes-256-gcm'
 WHERE algorithm = '';
