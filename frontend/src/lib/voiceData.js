export const VOICE_TOPICS = {
    hand: "hand",
    captions: "captions",
    soundboard: "soundboard",
};

export function encodePayload(data) {
    return new TextEncoder().encode(JSON.stringify(data));
}

export function decodePayload(payload) {
    try {
        return JSON.parse(new TextDecoder().decode(payload));
    } catch {
        return null;
    }
}

export function isSafeSoundUrl(value) {
    const url = String(value ?? "");
    if (!url || url.length > 500) return false;
    if (url.startsWith("/media/") || url.startsWith("/api/")) return true;
    try {
        const parsed = new URL(url);
        return parsed.protocol === "https:" && !parsed.username && !parsed.password;
    } catch {
        return false;
    }
}
