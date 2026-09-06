"use strict";

const QUOTA_BYTES = 5 * 1024 * 1024 * 1024;

const PENDING_TTL_MS = 6 * 60 * 60 * 1000;

const levelOf = (share) => (share >= 100 ? "full" : share >= 85 ? "warning" : "ok");

const shareOf = (usedBytes) => Math.round((Number(usedBytes) / QUOTA_BYTES) * 100);

const remainingOf = (usedBytes) => Math.max(0, QUOTA_BYTES - Number(usedBytes));

const fits = (usedBytes, incomingBytes) => Number(usedBytes) + Number(incomingBytes) <= QUOTA_BYTES;

module.exports = { QUOTA_BYTES, PENDING_TTL_MS, levelOf, shareOf, remainingOf, fits };
