import { api } from "./api.js";

export const isSupported = () =>
    typeof window !== "undefined" && typeof window.PublicKeyCredential === "function";

export async function canSignInWithoutPassword() {
    if (!isSupported()) return false;
    try {
        return await window.PublicKeyCredential.isConditionalMediationAvailable?.() ?? false;
    } catch {
        return false;
    }
}

const toBuffer = (value) => {
    const padded = String(value).replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(padded);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
};

const toBase64Url = (buffer) => {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

function decodeOptions(options) {
    return {
        ...options,
        challenge: toBuffer(options.challenge),
        ...(options.user ? { user: { ...options.user, id: toBuffer(options.user.id) } } : {}),
        ...(options.excludeCredentials
            ? { excludeCredentials: options.excludeCredentials.map((item) => ({ ...item, id: toBuffer(item.id) })) }
            : {}),
        ...(options.allowCredentials
            ? { allowCredentials: options.allowCredentials.map((item) => ({ ...item, id: toBuffer(item.id) })) }
            : {}),
    };
}

const encodeCredential = (credential) => ({
    id: credential.id,
    rawId: toBase64Url(credential.rawId),
    type: credential.type,
    clientExtensionResults: credential.getClientExtensionResults(),
    authenticatorAttachment: credential.authenticatorAttachment ?? undefined,
    response: {
        clientDataJSON: toBase64Url(credential.response.clientDataJSON),
        ...(credential.response.attestationObject
            ? {
                  attestationObject: toBase64Url(credential.response.attestationObject),
                  transports: credential.response.getTransports?.() ?? [],
              }
            : {}),
        ...(credential.response.authenticatorData
            ? {
                  authenticatorData: toBase64Url(credential.response.authenticatorData),
                  signature: toBase64Url(credential.response.signature),
                  userHandle: credential.response.userHandle ? toBase64Url(credential.response.userHandle) : null,
              }
            : {}),
    },
});

export async function registerKey(label) {
    const { options } = await api("/auth/security-keys/options", { method: "POST" });
    const credential = await navigator.credentials.create({ publicKey: decodeOptions(options) });
    if (!credential) throw new Error("Aucune clé n’a été présentée.");

    return api("/auth/security-keys", {
        method: "POST",
        body: { challenge: options.challenge, label, credential: encodeCredential(credential) },
    });
}

export async function signInWithKey({ signal } = {}) {
    const { options } = await api("/auth/security-keys/login/options", { method: "POST" });
    const credential = await navigator.credentials.get({ publicKey: decodeOptions(options), signal });
    if (!credential) throw new Error("Aucune clé n’a été présentée.");

    return api("/auth/security-keys/login", {
        method: "POST",
        body: { challenge: options.challenge, credential: encodeCredential(credential) },
    });
}
