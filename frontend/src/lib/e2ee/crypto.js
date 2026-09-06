import { ml_kem768 } from "@noble/post-quantum/ml-kem.js";
import { x25519 } from "@noble/curves/ed25519.js";

export const ALGORITHM = "x25519+ml-kem-768/hkdf-sha256/aes-256-gcm";
export const KEM_PUBLIC_BYTES = 1184;
export const KEM_CIPHERTEXT_BYTES = 1088;
export const ENVELOPE_PREFIX = "QW1";
const CURVE_KEY_BYTES = 32;
const INFO = new TextEncoder().encode("qweillo/e2ee/v1/wrap");
const MEDIA_INFO = new TextEncoder().encode("qweillo/e2ee/v1/media");
const MEDIA_SALT = new TextEncoder().encode("qweillo/e2ee/v1/media-salt");
const IV_BYTES = 12;

const subtle = () => globalThis.crypto.subtle;

export const toBase64 = (bytes) => {
    let binary = "";
    const view = new Uint8Array(bytes);
    for (let i = 0; i < view.length; i += 1) binary += String.fromCharCode(view[i]);
    return btoa(binary);
};

export const fromBase64 = (value) => {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes;
};

const concat = (...parts) => {
    const total = parts.reduce((sum, part) => sum + part.length, 0);
    const out = new Uint8Array(total);
    let offset = 0;
    for (const part of parts) {
        out.set(part, offset);
        offset += part.length;
    }
    return out;
};

export async function generateDeviceKeyPair() {
    const privateKey = x25519.utils.randomSecretKey();
    return { privateKey, publicKey: x25519.getPublicKey(privateKey) };
}

export function generateKemKeyPair() {
    const pair = ml_kem768.keygen();
    return { publicKey: pair.publicKey, secretKey: pair.secretKey };
}

export function kemEncapsulate(recipientPublicKey) {
    const { cipherText, sharedSecret } = ml_kem768.encapsulate(new Uint8Array(recipientPublicKey));
    return { cipherText, sharedSecret };
}

export function kemDecapsulate(cipherText, secretKey) {
    return ml_kem768.decapsulate(new Uint8Array(cipherText), new Uint8Array(secretKey));
}

export async function exportPublicKey(publicKey) {
    return new Uint8Array(publicKey);
}

export async function importPublicKey(bytes) {
    const key = new Uint8Array(bytes);
    if (key.length !== CURVE_KEY_BYTES) throw new Error("Clé publique d'appareil invalide.");
    return key;
}

export async function fingerprint(publicKeyBytes) {
    const digest = await subtle().digest("SHA-256", publicKeyBytes);
    return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export const readableFingerprint = (hex) => (hex.match(/.{1,4}/g) ?? []).slice(0, 10).join(" ");

export async function generateEpochKey() {
    return globalThis.crypto.getRandomValues(new Uint8Array(32));
}

export async function importEpochKey(raw) {
    return subtle().importKey("raw", raw, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}

export async function deriveMediaKey(epochKeyRaw) {
    const base = await subtle().importKey("raw", epochKeyRaw, "HKDF", false, ["deriveBits"]);
    return new Uint8Array(
        await subtle().deriveBits(
            { name: "HKDF", hash: "SHA-256", salt: MEDIA_SALT, info: MEDIA_INFO },
            base,
            256
        )
    );
}

async function deriveWrapKey(privateKey, peerPublicKey, { ephemeralPublicKeyBytes, deviceId, pqSecret }) {
    if (!pqSecret || pqSecret.length === 0) {
        throw new Error("Secret post-quantique manquant : le tirage hybride exige les deux parts.");
    }
    const shared = x25519.getSharedSecret(new Uint8Array(privateKey), new Uint8Array(peerPublicKey));
    const ikm = concat(shared, new Uint8Array(pqSecret));
    const base = await subtle().importKey("raw", ikm, "HKDF", false, ["deriveKey"]);
    const salt = concat(new Uint8Array(ephemeralPublicKeyBytes), new TextEncoder().encode(`:${deviceId}`));
    return subtle().deriveKey(
        { name: "HKDF", hash: "SHA-256", salt, info: INFO },
        base,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"]
    );
}

export async function wrapEpochKey(epochKeyRaw, {
    ephemeralPrivateKey,
    ephemeralPublicKeyBytes,
    recipientPublicKey,
    recipientKemPublicKey,
    deviceId,
}) {
    const kem = kemEncapsulate(recipientKemPublicKey);
    const wrapKey = await deriveWrapKey(ephemeralPrivateKey, recipientPublicKey, {
        ephemeralPublicKeyBytes,
        deviceId,
        pqSecret: kem.sharedSecret,
    });
    const iv = globalThis.crypto.getRandomValues(new Uint8Array(IV_BYTES));
    const sealed = new Uint8Array(await subtle().encrypt({ name: "AES-GCM", iv }, wrapKey, epochKeyRaw));
    return { wrapped: concat(iv, sealed), kemCipherText: kem.cipherText };
}

export async function unwrapEpochRaw(wrapped, {
    devicePrivateKey,
    deviceKemSecretKey,
    kemCipherText,
    ephemeralPublicKey,
    ephemeralPublicKeyBytes,
    deviceId,
}) {
    const pqSecret = kemDecapsulate(kemCipherText, deviceKemSecretKey);
    const wrapKey = await deriveWrapKey(devicePrivateKey, ephemeralPublicKey, {
        ephemeralPublicKeyBytes,
        deviceId,
        pqSecret,
    });
    const bytes = new Uint8Array(wrapped);
    const iv = bytes.slice(0, IV_BYTES);
    const sealed = bytes.slice(IV_BYTES);
    return new Uint8Array(await subtle().decrypt({ name: "AES-GCM", iv }, wrapKey, sealed));
}

export async function unwrapEpochKey(wrapped, options) {
    return importEpochKey(await unwrapEpochRaw(wrapped, options));
}

const additionalData = (channelId, epoch) => new TextEncoder().encode(`qweillo/v1/${channelId}/${epoch}`);

export function parseEnvelope(text) {
    if (typeof text !== "string" || !text.startsWith(`${ENVELOPE_PREFIX}:`)) return null;
    const parts = text.split(":");
    if (parts.length !== 4) return null;
    const epoch = Number(parts[1]);
    if (!Number.isInteger(epoch) || epoch < 1) return null;
    try {
        return { epoch, iv: fromBase64(parts[2]), ciphertext: fromBase64(parts[3]) };
    } catch {
        return null;
    }
}

export const isEncrypted = (text) => parseEnvelope(text) !== null;

export async function encryptMessage(plaintext, epochKey, { channelId, epoch }) {
    const iv = globalThis.crypto.getRandomValues(new Uint8Array(IV_BYTES));
    const ciphertext = new Uint8Array(
        await subtle().encrypt(
            { name: "AES-GCM", iv, additionalData: additionalData(channelId, epoch) },
            epochKey,
            new TextEncoder().encode(plaintext)
        )
    );
    return `${ENVELOPE_PREFIX}:${epoch}:${toBase64(iv)}:${toBase64(ciphertext)}`;
}

export async function decryptMessage(envelopeText, epochKey, { channelId }) {
    const envelope = parseEnvelope(envelopeText);
    if (!envelope) return null;
    try {
        const plaintext = await subtle().decrypt(
            { name: "AES-GCM", iv: envelope.iv, additionalData: additionalData(channelId, envelope.epoch) },
            epochKey,
            envelope.ciphertext
        );
        return new TextDecoder().decode(plaintext);
    } catch {
        return null;
    }
}
