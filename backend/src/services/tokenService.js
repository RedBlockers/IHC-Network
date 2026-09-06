"use strict";

const jwt = require("jsonwebtoken");

const config = require("../config");
const { Unauthorized } = require("../errors");

const toEpochSeconds = (date) => Math.floor(new Date(date).getTime() / 1000);

function sign(user) {
    return jwt.sign(
        { sub: String(user.userId), pwd: toEpochSeconds(user.passwordUpdatedAt), typ: "access" },
        config.JWT_SECRET,
        {
            expiresIn: config.ACCESS_TOKEN_TTL_SECONDS,
            algorithm: "HS256",
            issuer: "qweillo",
            audience: "qweillo-app",
            jwtid: require("node:crypto").randomUUID(),
        }
    );
}

function verify(token) {
    if (!token) throw new Unauthorized("Jeton manquant.");
    try {
        const payload = jwt.verify(token, config.JWT_SECRET, {
            algorithms: ["HS256"],
            issuer: "qweillo",
            audience: "qweillo-app",
        });
        if (payload.typ !== "access") throw new Error("wrong token type");
        return { userId: Number(payload.sub), passwordEpoch: Number(payload.pwd) };
    } catch {
        throw new Unauthorized("Jeton invalide ou expiré.");
    }
}

function matchesUser(payload, user) {
    return payload.passwordEpoch === toEpochSeconds(user.passwordUpdatedAt);
}

module.exports = { sign, verify, matchesUser, toEpochSeconds };
