"use strict";

const net = require("node:net");

const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);
const ALLOWED_PORTS = new Set(["", "80", "443", "8080", "8443"]);

const toInt = (address) =>
    address.split(".").reduce((total, octet) => (total << 8) + Number(octet), 0) >>> 0;

const inRange = (address, cidr) => {
    const [base, bits] = cidr.split("/");
    const mask = bits === "0" ? 0 : (0xffffffff << (32 - Number(bits))) >>> 0;
    return (toInt(address) & mask) === (toInt(base) & mask);
};

const BLOCKED_V4 = [
    "0.0.0.0/8",
    "10.0.0.0/8",
    "100.64.0.0/10",
    "127.0.0.0/8",
    "169.254.0.0/16",
    "172.16.0.0/12",
    "192.0.0.0/24",
    "192.0.2.0/24",
    "192.168.0.0/16",
    "198.18.0.0/15",
    "198.51.100.0/24",
    "203.0.113.0/24",
    "224.0.0.0/4",
    "240.0.0.0/4",
];

function isPublicAddress(address) {
    const version = net.isIP(address);
    if (version === 4) return !BLOCKED_V4.some((cidr) => inRange(address, cidr));

    if (version === 6) {
        const value = address.toLowerCase();
        if (value === "::" || value === "::1") return false;
        if (/^f[cd]/.test(value) || /^fe[89ab]/.test(value)) return false;
        const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(value);
        if (mapped) return isPublicAddress(mapped[1]);
        return true;
    }

    return false;
}

function inspect(rawUrl) {
    let url;
    try {
        url = new URL(String(rawUrl));
    } catch {
        return { ok: false, reason: "adresse illisible" };
    }

    if (!ALLOWED_PROTOCOLS.has(url.protocol)) return { ok: false, reason: "protocole refusé" };
    if (url.username || url.password) return { ok: false, reason: "identifiants dans l'adresse" };
    if (!ALLOWED_PORTS.has(url.port)) return { ok: false, reason: "port refusé" };

    if (net.isIP(url.hostname) && !isPublicAddress(url.hostname)) {
        return { ok: false, reason: "adresse interne" };
    }
    if (/^localhost$/i.test(url.hostname) || url.hostname.endsWith(".localhost")) {
        return { ok: false, reason: "adresse interne" };
    }

    return { ok: true, url };
}

const allPublic = (addresses) => addresses.length > 0 && addresses.every((entry) => isPublicAddress(entry.address ?? entry));

module.exports = { inspect, isPublicAddress, allPublic, ALLOWED_PROTOCOLS, ALLOWED_PORTS, BLOCKED_V4 };
