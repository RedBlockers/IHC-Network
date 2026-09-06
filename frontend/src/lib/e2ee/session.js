import { api } from "../api.js";
import {
    decryptMessage,
    encryptMessage,
    exportPublicKey,
    fingerprint,
    fromBase64,
    generateDeviceKeyPair,
    generateEpochKey,
    generateKemKeyPair,
    importEpochKey,
    importPublicKey,
    deriveMediaKey,
    toBase64,
    unwrapEpochRaw,
    wrapEpochKey,
} from "./crypto.js";
import { isSupported, loadIdentity, saveIdentity } from "./keystore.js";

export function createSession({ request, keystore, deviceLabel = () => "" }) {
    const epochKeys = new Map();
    const epochRaws = new Map();
    let identityPromise = null;

    const cacheKey = (channelId, epoch) => `${channelId}:${epoch}`;

    async function ensureDevice() {
        if (identityPromise) return identityPromise;

        identityPromise = (async () => {
            let record = await keystore.load();
            if (record && !(record.keyPair?.privateKey instanceof Uint8Array)) record = null;
            if (!record) {
                const keyPair = await generateDeviceKeyPair();
                const publicKey = await exportPublicKey(keyPair.publicKey);
                const kem = generateKemKeyPair();
                record = {
                    keyPair,
                    publicKey,
                    kemPublicKey: kem.publicKey,
                    kemSecretKey: kem.secretKey,
                    fingerprint: await fingerprint(new Uint8Array([...publicKey, ...kem.publicKey])),
                };
            }

            const { device } = await request("/e2ee/devices", {
                method: "POST",
                body: {
                    publicKey: toBase64(record.publicKey),
                    kemPublicKey: toBase64(record.kemPublicKey),
                    label: deviceLabel(),
                },
            });

            record = { ...record, deviceId: device.deviceId };
            await keystore.save(record);
            return record;
        })().catch((error) => {
            identityPromise = null;
            throw error;
        });

        return identityPromise;
    }

    async function rotate(channelId, identity) {
        const { devices } = await request(`/channels/${channelId}/e2ee/recipients`);
        const ephemeral = await generateDeviceKeyPair();
        const ephemeralPublicKeyBytes = await exportPublicKey(ephemeral.publicKey);
        const epochKeyRaw = await generateEpochKey();

        const shares = await Promise.all(
            devices.map(async (device) => {
                const { wrapped, kemCipherText } = await wrapEpochKey(epochKeyRaw, {
                    ephemeralPrivateKey: ephemeral.privateKey,
                    ephemeralPublicKeyBytes,
                    recipientPublicKey: await importPublicKey(fromBase64(device.publicKey)),
                    recipientKemPublicKey: fromBase64(device.kemPublicKey),
                    deviceId: device.deviceId,
                });
                return {
                    deviceId: device.deviceId,
                    wrappedKey: toBase64(wrapped),
                    kemCipherText: toBase64(kemCipherText),
                };
            })
        );

        const created = await request(`/channels/${channelId}/e2ee/epoch`, {
            method: "POST",
            body: {
                deviceId: identity.deviceId,
                ephemeralPublicKey: toBase64(ephemeralPublicKeyBytes),
                shares,
            },
        });

        const key = await importEpochKey(epochKeyRaw);
        epochKeys.set(cacheKey(channelId, created.epoch), key);
        epochRaws.set(cacheKey(channelId, created.epoch), epochKeyRaw);
        return { epoch: created.epoch, key };
    }

    async function unwrapFromState(channelId, identity, state) {
        const ephemeralPublicKeyBytes = fromBase64(state.epoch.ephemeralPublicKey);
        const options = {
            devicePrivateKey: identity.keyPair.privateKey,
            deviceKemSecretKey: identity.kemSecretKey,
            kemCipherText: fromBase64(state.kemCipherText),
            ephemeralPublicKey: await importPublicKey(ephemeralPublicKeyBytes),
            ephemeralPublicKeyBytes,
            deviceId: identity.deviceId,
        };
        const raw = await unwrapEpochRaw(fromBase64(state.wrappedKey), options);
        const key = await importEpochKey(raw);
        epochKeys.set(cacheKey(channelId, state.epoch.epoch), key);
        epochRaws.set(cacheKey(channelId, state.epoch.epoch), raw);
        return key;
    }

    async function keyForSending(channelId) {
        const identity = await ensureDevice();
        const state = await request(`/channels/${channelId}/e2ee/epoch?deviceId=${identity.deviceId}`);

        if (!state.epoch || state.stale || !state.wrappedKey) return rotate(channelId, identity);

        const cached = epochKeys.get(cacheKey(channelId, state.epoch.epoch));
        if (cached) return { epoch: state.epoch.epoch, key: cached };

        return { epoch: state.epoch.epoch, key: await unwrapFromState(channelId, identity, state) };
    }

    async function keyForEpoch(channelId, epoch) {
        const cached = epochKeys.get(cacheKey(channelId, epoch));
        if (cached) return cached;

        const identity = await ensureDevice();
        const state = await request(`/channels/${channelId}/e2ee/epoch?deviceId=${identity.deviceId}`);
        if (!state.epoch || state.epoch.epoch !== epoch || !state.wrappedKey) return null;

        return unwrapFromState(channelId, identity, state);
    }

    return {
        ensureDevice,
        keyForSending,
        keyForEpoch,

        async encryptForChannel(channelId, plaintext) {
            const { epoch, key } = await keyForSending(channelId);
            return encryptMessage(plaintext, key, { channelId, epoch });
        },

        async decryptForChannel(channelId, envelope, epoch) {
            const key = await keyForEpoch(channelId, epoch);
            if (!key) return null;
            return decryptMessage(envelope, key, { channelId });
        },

        async rawKeyForChannel(channelId) {
            const { epoch } = await keyForSending(channelId);
            return epochRaws.get(cacheKey(channelId, epoch)) ?? null;
        },

        async mediaKeyForChannel(channelId) {
            const { epoch } = await keyForSending(channelId);
            const raw = epochRaws.get(cacheKey(channelId, epoch));
            if (!raw) return null;
            return deriveMediaKey(raw);
        },

        forgetChannel(channelId) {
            for (const key of [...epochKeys.keys()]) {
                if (key.startsWith(`${channelId}:`)) {
                    epochKeys.delete(key);
                    epochRaws.delete(key);
                }
            }
        },

        reset() {
            epochKeys.clear();
            epochRaws.clear();
            identityPromise = null;
        },
    };
}

const session = createSession({
    request: api,
    keystore: { load: loadIdentity, save: saveIdentity },
    deviceLabel: () => (typeof navigator === "undefined" ? "" : navigator.userAgent.slice(0, 60)),
});

export const supported = isSupported;
export const ensureDevice = (...args) => session.ensureDevice(...args);
export const encryptForChannel = (...args) => session.encryptForChannel(...args);
export const decryptForChannel = (...args) => session.decryptForChannel(...args);
export const forgetChannel = (...args) => session.forgetChannel(...args);
export const rawKeyForChannel = (...args) => session.rawKeyForChannel(...args);
export const mediaKeyForChannel = (...args) => session.mediaKeyForChannel(...args);
export const reset = (...args) => session.reset(...args);
