"use strict";

const tokenService = require("../../src/services/tokenService");
const { on } = require("./db");

function makeUser(overrides = {}) {
    return {
        userId: 1,
        handle: "ada",
        displayName: "Ada",
        email: "ada@example.com",
        avatar: "/assets/default-avatar.png",
        aboutMe: "",
        presence: "online",
        isBot: 0,
        isEmailVerified: 1,
        isBanned: 0,
        bannedUntil: null,
        passwordUpdatedAt: new Date("2026-01-01T00:00:00.000Z"),
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        ...overrides,
    };
}

function authenticateAs(...users) {
    const byId = new Map(users.map((u) => [Number(u.userId), u]));
    on("users.findById", (params) => {
        const found = byId.get(Number(params[0]));
        return found ? [found] : [];
    });
    return (user) => `Bearer ${tokenService.sign(user)}`;
}

module.exports = { makeUser, authenticateAs };
