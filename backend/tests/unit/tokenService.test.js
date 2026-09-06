"use strict";

const jwt = require("jsonwebtoken");

const tokenService = require("../../src/services/tokenService");
const { Unauthorized } = require("../../src/errors");

const user = { userId: 42, passwordUpdatedAt: new Date("2026-01-01T00:00:00.000Z") };

describe("tokenService", () => {
    it("signe puis vérifie un jeton cohérent", () => {
        const token = tokenService.sign(user);
        const payload = tokenService.verify(token);
        expect(payload.userId).toBe(42);
        expect(tokenService.matchesUser(payload, user)).toBe(true);
    });

    it("invalide le jeton si le mot de passe a changé après émission", () => {
        const token = tokenService.sign(user);
        const payload = tokenService.verify(token);
        const rotated = { ...user, passwordUpdatedAt: new Date("2026-02-01T00:00:00.000Z") };
        expect(tokenService.matchesUser(payload, rotated)).toBe(false);
    });

    it("rejette un jeton absent", () => {
        expect(() => tokenService.verify(null)).toThrow(Unauthorized);
    });

    it("rejette une signature invalide", () => {
        const forged = jwt.sign({ sub: "1", pwd: 0 }, "mauvaise-cle-de-signature-differente!!", { algorithm: "HS256" });
        expect(() => tokenService.verify(forged)).toThrow(Unauthorized);
    });

    it("rejette la confusion d'algorithme (alg=none)", () => {
        const none = jwt.sign({ sub: "1", pwd: 0 }, "", { algorithm: "none" });
        expect(() => tokenService.verify(none)).toThrow(Unauthorized);
    });
});
