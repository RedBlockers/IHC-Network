"use strict";

const crypto = require("node:crypto");

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const STEP_SECONDS = 30;
const DIGITS = 6;

function generateSecret(bytes = 20) {
    return encodeBase32(crypto.randomBytes(bytes));
}

function encodeBase32(buffer) {
    let bits = 0;
    let value = 0;
    let output = "";

    for (const byte of buffer) {
        value = (value << 8) | byte;
        bits += 8;
        while (bits >= 5) {
            output += ALPHABET[(value >>> (bits - 5)) & 31];
            bits -= 5;
        }
    }
    if (bits > 0) output += ALPHABET[(value << (5 - bits)) & 31];
    return output;
}

function decodeBase32(secret) {
    const clean = String(secret ?? "").toUpperCase().replace(/[\s=]/g, "");
    let bits = 0;
    let value = 0;
    const bytes = [];

    for (const character of clean) {
        const index = ALPHABET.indexOf(character);
        if (index === -1) throw new Error("Secret TOTP invalide.");
        value = (value << 5) | index;
        bits += 5;
        if (bits >= 8) {
            bytes.push((value >>> (bits - 8)) & 255);
            bits -= 8;
        }
    }
    return Buffer.from(bytes);
}

function codeAt(secret, counter) {
    const key = decodeBase32(secret);
    const message = Buffer.alloc(8);
    message.writeBigUInt64BE(BigInt(counter));

    const digest = crypto.createHmac("sha1", key).update(message).digest();
    const offset = digest[digest.length - 1] & 0x0f;
    const binary =
        ((digest[offset] & 0x7f) << 24) |
        ((digest[offset + 1] & 0xff) << 16) |
        ((digest[offset + 2] & 0xff) << 8) |
        (digest[offset + 3] & 0xff);

    return String(binary % 10 ** DIGITS).padStart(DIGITS, "0");
}

function verify(secret, code, { now = Date.now(), window = 1 } = {}) {
    const candidate = String(code ?? "").replace(/\s/g, "");
    if (!/^\d{6}$/.test(candidate)) return null;

    const counter = Math.floor(now / 1000 / STEP_SECONDS);
    for (let drift = -window; drift <= window; drift += 1) {
        const expected = codeAt(secret, counter + drift);
        if (crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(candidate))) {
            return counter + drift;
        }
    }
    return null;
}

function provisioningUri(secret, { account, issuer = "Qweillo" }) {
    const label = encodeURIComponent(`${issuer}:${account}`);
    const params = new URLSearchParams({
        secret,
        issuer,
        algorithm: "SHA1",
        digits: String(DIGITS),
        period: String(STEP_SECONDS),
    });
    return `otpauth://totp/${label}?${params}`;
}

module.exports = { generateSecret, codeAt, verify, provisioningUri, encodeBase32, decodeBase32, STEP_SECONDS, DIGITS };
