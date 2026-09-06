import assert from "node:assert/strict";
import test from "node:test";

import {
    ALGORITHM,
    KEM_CIPHERTEXT_BYTES,
    KEM_PUBLIC_BYTES,
    generateKemKeyPair,
    kemDecapsulate,
    kemEncapsulate,
    decryptMessage,
    encryptMessage,
    exportPublicKey,
    fingerprint,
    generateDeviceKeyPair,
    generateEpochKey,
    deriveMediaKey,
    importEpochKey,
    importPublicKey,
    isEncrypted,
    parseEnvelope,
    readableFingerprint,
    unwrapEpochKey,
    wrapEpochKey,
} from "../src/lib/e2ee/crypto.js";

test("une identité d'appareil est une paire X25519 de 32 octets", async () => {
    const pair = await generateDeviceKeyPair();
    assert.ok(pair.privateKey instanceof Uint8Array);
    assert.equal(pair.privateKey.length, 32);
    const raw = await exportPublicKey(pair.publicKey);
    assert.equal(raw.length, 32);
    assert.notDeepEqual([...raw], [...pair.privateKey]);
    const again = await generateDeviceKeyPair();
    assert.notDeepEqual([...again.publicKey], [...raw]);
    await assert.rejects(() => importPublicKey(new Uint8Array(31)));
});

test("l'empreinte identifie la clé publique et reste lisible", async () => {
    const pair = await generateDeviceKeyPair();
    const raw = await exportPublicKey(pair.publicKey);
    const hex = await fingerprint(raw);
    assert.equal(hex.length, 64);
    assert.equal(await fingerprint(raw), hex);
    assert.match(readableFingerprint(hex), /^([0-9a-f]{4} ){9}[0-9a-f]{4}$/);
});

test("la clé de salon voyage enveloppée et se retrouve à l'identique", async () => {
    const device = await generateDeviceKeyPair();
    const ephemeral = await generateDeviceKeyPair();
    const epochKeyRaw = await generateEpochKey();

    const ephemeralPublicKeyBytes = await exportPublicKey(ephemeral.publicKey);
    const kem = generateKemKeyPair();

    const { wrapped, kemCipherText } = await wrapEpochKey(epochKeyRaw, {
        ephemeralPrivateKey: ephemeral.privateKey,
        ephemeralPublicKeyBytes,
        recipientPublicKey: device.publicKey,
        recipientKemPublicKey: kem.publicKey,
        deviceId: 11,
    });

    const unwrapped = await unwrapEpochKey(wrapped, {
        devicePrivateKey: device.privateKey,
        deviceKemSecretKey: kem.secretKey,
        kemCipherText,
        ephemeralPublicKey: ephemeral.publicKey,
        ephemeralPublicKeyBytes,
        deviceId: 11,
    });

    const reference = await importEpochKey(epochKeyRaw);
    const message = await encryptMessage("la taverne ouvre à 21 h", reference, { channelId: 20, epoch: 4 });
    assert.equal(await decryptMessage(message, unwrapped, { channelId: 20 }), "la taverne ouvre à 21 h");
});

test("une enveloppe destinée à un autre appareil ne s'ouvre pas", async () => {
    const alice = await generateDeviceKeyPair();
    const mallory = await generateDeviceKeyPair();
    const ephemeral = await generateDeviceKeyPair();
    const epochKeyRaw = await generateEpochKey();

    const ephemeralPublicKeyBytes = await exportPublicKey(ephemeral.publicKey);
    const kem = generateKemKeyPair();
    const { wrapped, kemCipherText } = await wrapEpochKey(epochKeyRaw, {
        ephemeralPrivateKey: ephemeral.privateKey,
        ephemeralPublicKeyBytes,
        recipientPublicKey: alice.publicKey,
        recipientKemPublicKey: kem.publicKey,
        deviceId: 11,
    });

    await assert.rejects(() =>
        unwrapEpochKey(wrapped, {
            devicePrivateKey: mallory.privateKey,
            deviceKemSecretKey: kem.secretKey,
            kemCipherText,
            ephemeralPublicKey: ephemeral.publicKey,
            ephemeralPublicKeyBytes,
            deviceId: 11,
        })
    );
});

test("le numéro d'appareil entre dans le tirage de la clé d'enveloppe", async () => {
    const device = await generateDeviceKeyPair();
    const ephemeral = await generateDeviceKeyPair();
    const epochKeyRaw = await generateEpochKey();
    const ephemeralPublicKeyBytes = await exportPublicKey(ephemeral.publicKey);
    const kem = generateKemKeyPair();

    const { wrapped, kemCipherText } = await wrapEpochKey(epochKeyRaw, {
        ephemeralPrivateKey: ephemeral.privateKey,
        ephemeralPublicKeyBytes,
        recipientPublicKey: device.publicKey,
        recipientKemPublicKey: kem.publicKey,
        deviceId: 11,
    });

    await assert.rejects(() =>
        unwrapEpochKey(wrapped, {
            devicePrivateKey: device.privateKey,
            deviceKemSecretKey: kem.secretKey,
            kemCipherText,
            ephemeralPublicKey: ephemeral.publicKey,
            ephemeralPublicKeyBytes,
            deviceId: 12,
        })
    );
});

test("un chiffré ne peut pas être rejoué dans un autre salon", async () => {
    const key = await importEpochKey(await generateEpochKey());
    const envelope = await encryptMessage("secret", key, { channelId: 20, epoch: 2 });
    assert.equal(await decryptMessage(envelope, key, { channelId: 20 }), "secret");
    assert.equal(await decryptMessage(envelope, key, { channelId: 21 }), null);
});

test("une clé d'époque différente ne déchiffre rien et ne renvoie pas de contenu inventé", async () => {
    const key = await importEpochKey(await generateEpochKey());
    const other = await importEpochKey(await generateEpochKey());
    const envelope = await encryptMessage("secret", key, { channelId: 20, epoch: 2 });
    assert.equal(await decryptMessage(envelope, other, { channelId: 20 }), null);
});

test("le chiffré ne contient jamais le texte clair", async () => {
    const key = await importEpochKey(await generateEpochKey());
    const envelope = await encryptMessage("rendez-vous derrière la cascade", key, { channelId: 20, epoch: 1 });
    assert.ok(!envelope.includes("cascade"));
    assert.ok(!envelope.includes("rendez"));
});

test("l'enveloppe se distingue d'un message en clair", async () => {
    const key = await importEpochKey(await generateEpochKey());
    const envelope = await encryptMessage("bonjour", key, { channelId: 7, epoch: 3 });

    assert.equal(isEncrypted(envelope), true);
    assert.equal(isEncrypted("bonjour tout le monde"), false);
    assert.equal(isEncrypted("QW1:pas-un-nombre:a:b"), false);
    assert.equal(parseEnvelope(envelope).epoch, 3);
    assert.equal(parseEnvelope("QW1:0:a:b"), null);
});

test("le nom d'algorithme dit ce qui est réellement appliqué", () => {
    assert.equal(ALGORITHM, "x25519+ml-kem-768/hkdf-sha256/aes-256-gcm");
});

test("l'identité post-quantique a les tailles de ML-KEM-768", () => {
    const kem = generateKemKeyPair();
    assert.equal(kem.publicKey.length, KEM_PUBLIC_BYTES);
    assert.equal(kem.secretKey.length, 2400);

    const encapsulated = kemEncapsulate(kem.publicKey);
    assert.equal(encapsulated.cipherText.length, KEM_CIPHERTEXT_BYTES);
    assert.equal(encapsulated.sharedSecret.length, 32);
    assert.deepEqual(kemDecapsulate(encapsulated.cipherText, kem.secretKey), encapsulated.sharedSecret);
});

test("une encapsulation destinée à un autre appareil ne donne pas le bon secret", () => {
    const alice = generateKemKeyPair();
    const mallory = generateKemKeyPair();
    const encapsulated = kemEncapsulate(alice.publicKey);

    const wrong = kemDecapsulate(encapsulated.cipherText, mallory.secretKey);
    assert.notDeepEqual(wrong, encapsulated.sharedSecret);
});

test("le tirage refuse de fonctionner sans sa part post-quantique", async () => {
    const device = await generateDeviceKeyPair();
    const ephemeral = await generateDeviceKeyPair();
    const epochKeyRaw = await generateEpochKey();
    const ephemeralPublicKeyBytes = await exportPublicKey(ephemeral.publicKey);

    await assert.rejects(
        () =>
            wrapEpochKey(epochKeyRaw, {
                ephemeralPrivateKey: ephemeral.privateKey,
                ephemeralPublicKeyBytes,
                recipientPublicKey: device.publicKey,
                recipientKemPublicKey: new Uint8Array(0),
                deviceId: 11,
            }),
        /.*/
    );
});

test("une clé publique reçue du serveur se réimporte telle quelle", async () => {
    const pair = await generateDeviceKeyPair();
    const raw = await exportPublicKey(pair.publicKey);
    const reimported = await importPublicKey(raw);
    assert.deepEqual(await exportPublicKey(reimported), raw);
});

test("la clé média est dérivée de l'époque et n'est pas l'époque elle-même", async () => {
    const epoch = await generateEpochKey();
    const media = await deriveMediaKey(epoch);
    assert.equal(media.length, 32);
    assert.notDeepEqual([...media], [...epoch]);
    assert.deepEqual([...(await deriveMediaKey(epoch))], [...media]);
});
