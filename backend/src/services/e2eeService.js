"use strict";

const crypto = require("node:crypto");

const e2eeRepository = require("../repositories/e2eeRepository");
const channelRepository = require("../repositories/channelRepository");
const { withTransaction } = require("../db/pool");
const realtime = require("../realtime");
const { BadRequest, Forbidden, NotFound } = require("../errors");

const X25519_KEY_BYTES = 32;
const MAX_WRAPPED_BYTES = 192;
const ALGORITHM = "x25519+ml-kem-768/hkdf-sha256/aes-256-gcm";
const KEM_PUBLIC_BYTES = 1184;
const KEM_CIPHERTEXT_BYTES = 1088;

const toBuffer = (base64, expected) => {
    const buffer = Buffer.from(base64, "base64");
    if (expected && buffer.length !== expected) throw new BadRequest("Matériel de clé invalide.");
    return buffer;
};

const fingerprintOf = (publicKey) => crypto.createHash("sha256").update(publicKey).digest("hex");

const toDevice = (row) => ({
    deviceId: Number(row.deviceId),
    userId: Number(row.userId),
    publicKey: Buffer.from(row.publicKey).toString("base64"),
    kemPublicKey: row.kemPublicKey ? Buffer.from(row.kemPublicKey).toString("base64") : null,
    fingerprint: row.fingerprint,
    label: row.label ?? "",
    createdAt: row.createdAt ?? null,
});

async function registerDevice(user, { publicKey, kemPublicKey, label = "" }) {
    const key = toBuffer(publicKey, X25519_KEY_BYTES);
    const kemKey = toBuffer(kemPublicKey, KEM_PUBLIC_BYTES);
    const fingerprint = fingerprintOf(Buffer.concat([key, kemKey]));

    const claimed = await e2eeRepository.findDeviceByFingerprint(fingerprint);
    if (claimed && Number(claimed.userId) !== Number(user.userId)) {
        throw new Forbidden("Cette clé d'appareil est déjà enregistrée par un autre compte.");
    }

    const row = await e2eeRepository.upsertDevice(user.userId, {
        publicKey: key,
        kemPublicKey: kemKey,
        fingerprint,
        label: label.slice(0, 60),
    });
    if (!row) throw new NotFound("Appareil introuvable après enregistrement.");
    return toDevice(row);
}

async function listOwnDevices(user) {
    const rows = await e2eeRepository.listDevicesForUser(user.userId);
    return rows.map(toDevice);
}

async function revokeDevice(user, deviceId) {
    const revoked = await e2eeRepository.revokeDevice(user.userId, deviceId);
    if (!revoked) throw new NotFound("Appareil introuvable.");
    realtime.emitToUser(Number(user.userId), "e2ee:device-revoked", { deviceId: Number(deviceId) });
}

async function listRecipients(channelId) {
    const rows = await e2eeRepository.listChannelRecipients(channelId);
    return rows.map(toDevice);
}

function shareSetIsCurrent(recipientIds, shareIds) {
    if (recipientIds.size !== shareIds.size) return false;
    for (const id of recipientIds) if (!shareIds.has(id)) return false;
    return true;
}

async function describeEpoch(user, channelId, deviceId) {
    const device = await e2eeRepository.findDeviceById(deviceId);
    if (!device || Number(device.userId) !== Number(user.userId) || device.revokedAt) {
        throw new Forbidden("Appareil inconnu pour ce compte.");
    }

    const epoch = await e2eeRepository.currentEpoch(channelId);
    if (!epoch) return { epoch: null, stale: true, algorithm: ALGORITHM };

    const [recipients, shares, share] = await Promise.all([
        e2eeRepository.listChannelRecipients(channelId),
        e2eeRepository.listShareDeviceIds(epoch.epochId),
        e2eeRepository.findShareForDevice(epoch.epochId, deviceId),
    ]);

    const recipientIds = new Set(recipients.map((row) => Number(row.deviceId)));
    const shareIds = new Set(shares.map((row) => Number(row.deviceId)));

    return {
        epoch: {
            epoch: Number(epoch.epoch),
            algorithm: epoch.algorithm,
            ephemeralPublicKey: Buffer.from(epoch.ephemeralPublicKey).toString("base64"),
            createdBy: Number(epoch.createdBy),
            createdAt: epoch.createdAt ?? null,
        },
        wrappedKey: share ? Buffer.from(share.wrappedKey).toString("base64") : null,
        kemCipherText: share?.kemCipherText ? Buffer.from(share.kemCipherText).toString("base64") : null,
        stale: !shareSetIsCurrent(recipientIds, shareIds),
        algorithm: ALGORITHM,
    };
}

async function rotateEpoch(user, channelId, { deviceId, ephemeralPublicKey, shares }) {
    const device = await e2eeRepository.findDeviceById(deviceId);
    if (!device || Number(device.userId) !== Number(user.userId) || device.revokedAt) {
        throw new Forbidden("Appareil inconnu pour ce compte.");
    }

    const ephemeral = toBuffer(ephemeralPublicKey, X25519_KEY_BYTES);
    const recipients = await e2eeRepository.listChannelRecipients(channelId);
    const recipientIds = new Set(recipients.map((row) => Number(row.deviceId)));

    if (!recipientIds.has(Number(deviceId))) {
        throw new Forbidden("Cet appareil ne fait pas partie des destinataires du salon.");
    }

    const seen = new Set();
    const rows = shares.map((share) => {
        const target = Number(share.deviceId);
        if (!recipientIds.has(target)) throw new BadRequest("Une part vise un appareil étranger au salon.");
        if (seen.has(target)) throw new BadRequest("Deux parts visent le même appareil.");
        seen.add(target);
        const wrappedKey = toBuffer(share.wrappedKey);
        if (wrappedKey.length === 0 || wrappedKey.length > MAX_WRAPPED_BYTES)
            throw new BadRequest("Part de clé invalide.");
        const kemCipherText = toBuffer(share.kemCipherText, KEM_CIPHERTEXT_BYTES);
        return { deviceId: target, wrappedKey, kemCipherText };
    });

    if (!shareSetIsCurrent(recipientIds, seen)) {
        throw new BadRequest("La distribution doit couvrir tous les appareils du salon.");
    }

    const epoch = await withTransaction(async (connection) => {
        const current = await e2eeRepository.currentEpoch(channelId, connection);
        const next = current ? Number(current.epoch) + 1 : 1;
        const epochId = await e2eeRepository.createEpoch(
            {
                channelId,
                epoch: next,
                createdBy: user.userId,
                createdByDeviceId: deviceId,
                ephemeralPublicKey: ephemeral,
                algorithm: ALGORITHM,
            },
            connection
        );
        await e2eeRepository.insertShares(epochId, rows, connection);
        await e2eeRepository.setChannelEpoch(channelId, next, connection);
        return next;
    });

    realtime.emitToChannel(Number(channelId), "e2ee:epoch", { channelId: Number(channelId), epoch });
    return { epoch, algorithm: ALGORITHM };
}

async function setEncryption(channelId, enabled) {
    const channel = await channelRepository.findById(channelId);
    if (!channel) throw new NotFound("Salon introuvable.");
    if (
        enabled &&
        ["ticket", "task", "wiki", "documentation", "resources", "faq", "event", "meeting", "poll"].includes(
            channel.type
        )
    ) {
        throw new BadRequest(
            "Le chiffrement des messages n’est pas disponible pour les contenus structurés de ce type de salon."
        );
    }
    await e2eeRepository.setChannelEncryption(channelId, enabled);
    realtime.emitToChannel(Number(channelId), "e2ee:setting", { channelId: Number(channelId), e2eeEnabled: enabled });
    return { channelId: Number(channelId), e2eeEnabled: enabled };
}

module.exports = {
    registerDevice,
    listOwnDevices,
    revokeDevice,
    listRecipients,
    describeEpoch,
    rotateEpoch,
    setEncryption,
    fingerprintOf,
    ALGORITHM,
};
