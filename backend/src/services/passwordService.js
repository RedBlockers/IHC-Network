"use strict";

const crypto = require("node:crypto");
const argon2 = require("argon2");
const bcrypt = require("bcrypt");
const config = require("../config");

const options = {
    type: argon2.argon2id,
    memoryCost: config.ARGON2_MEMORY_KIB,
    timeCost: config.ARGON2_TIME_COST,
    parallelism: config.ARGON2_PARALLELISM,
    hashLength: 32,
};

const unknownHash = argon2.hash(crypto.randomBytes(32), options);

const hash = (password) => argon2.hash(password, options);

async function verify(encoded, password) {
    if (encoded?.startsWith("$argon2id$")) return argon2.verify(encoded, password);
    if (encoded?.startsWith("$2")) return bcrypt.compare(password, encoded);
    return false;
}

async function verifyUnknown(password) {
    await argon2.verify(await unknownHash, password).catch(() => false);
    return false;
}

function needsRehash(encoded) {
    return !encoded?.startsWith("$argon2id$") || argon2.needsRehash(encoded, options);
}

module.exports = { hash, verify, verifyUnknown, needsRehash };
