"use strict";

const dgram = require("node:dgram");
const crypto = require("node:crypto");

const config = require("../config");

const MAGIC_COOKIE = 0x2112a442;
const BINDING_REQUEST = 0x0001;
const BINDING_SUCCESS = 0x0101;
const BINDING_ERROR = 0x0111;
const CACHE_MS = 15_000;
const DEFAULT_TIMEOUT_MS = 400;

let cached = { at: 0, value: null };

function bindingRequest() {
    const transactionId = crypto.randomBytes(12);
    const packet = Buffer.alloc(20);
    packet.writeUInt16BE(BINDING_REQUEST, 0);
    packet.writeUInt16BE(0, 2);
    packet.writeUInt32BE(MAGIC_COOKIE, 4);
    transactionId.copy(packet, 8);
    return { packet, transactionId };
}

function isStunResponse(packet, transactionId) {
    if (!Buffer.isBuffer(packet) || packet.length < 20) return false;
    const type = packet.readUInt16BE(0);
    if (type !== BINDING_SUCCESS && type !== BINDING_ERROR) return false;
    if (packet.readUInt32BE(4) !== MAGIC_COOKIE) return false;
    return packet.subarray(8, 20).equals(transactionId);
}

function publicView(result) {
    if (!result || !result.configured) return { configured: false };
    return {
        configured: true,
        reachable: Boolean(result.reachable),
        host: result.host,
        port: result.port,
    };
}

function defaultCreateSocket(host) {
    return dgram.createSocket(host && host.includes(":") ? "udp6" : "udp4");
}

async function probeTurn({ host, port, timeoutMs = DEFAULT_TIMEOUT_MS, createSocket = defaultCreateSocket } = {}) {
    if (!host) return { configured: false };
    const { packet, transactionId } = bindingRequest();

    return new Promise((resolve) => {
        let socket;
        let finished = false;
        const finish = (reachable) => {
            if (finished) return;
            finished = true;
            clearTimeout(timer);
            try {
                socket.close();
            } catch {}
            resolve({ configured: true, reachable, host, port: Number(port) });
        };

        const timer = setTimeout(() => finish(false), timeoutMs);
        try {
            socket = createSocket(host);
        } catch {
            finish(false);
            return;
        }

        socket.once("error", () => finish(false));
        socket.once("message", (message) => finish(isStunResponse(message, transactionId)));
        socket.send(packet, Number(port), host, (error) => {
            if (error) finish(false);
        });
    });
}

function readCache(now) {
    if (cached.value && now - cached.at < CACHE_MS) return cached.value;
    return null;
}

async function describeTurn({ now = Date.now(), probe = probeTurn } = {}) {
    const host = config.LIVEKIT_TURN_HOST;
    const port = config.LIVEKIT_TURN_PORT;
    if (!host) return publicView({ configured: false });
    const hit = readCache(now);
    if (hit) return hit;
    const value = publicView(await probe({ host, port }));
    cached = { at: now, value };
    return value;
}

function resetCache() {
    cached = { at: 0, value: null };
}

module.exports = {
    bindingRequest,
    isStunResponse,
    publicView,
    probeTurn,
    describeTurn,
    resetCache,
};
