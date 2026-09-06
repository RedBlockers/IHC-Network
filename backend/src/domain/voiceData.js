"use strict";

const TOPICS = Object.freeze({
    hand: "hand",
    captions: "captions",
    soundboard: "soundboard",
});

const isSafeSoundUrl = (value) => {
    const url = String(value ?? "");
    if (!url || url.length > 500) return false;
    if (url.startsWith("/media/") || url.startsWith("/api/")) return true;
    try {
        const parsed = new URL(url);
        return parsed.protocol === "https:" && !parsed.username && !parsed.password;
    } catch {
        return false;
    }
};

module.exports = { TOPICS, isSafeSoundUrl };
