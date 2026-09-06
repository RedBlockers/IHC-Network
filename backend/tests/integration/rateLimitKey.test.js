"use strict";

const { keyOf } = require("../../src/middlewares/rateLimit");

describe("Clé de limitation de débit", () => {
    it("compte par compte dès que la personne est connue", () => {
        expect(keyOf({ user: { userId: 42 }, ip: "10.0.0.1" })).toBe("u:42");
        expect(keyOf({ user: { userId: 43 }, ip: "10.0.0.1" })).toBe("u:43");
    });

    it("retombe sur l'adresse avant toute connexion", () => {
        expect(keyOf({ ip: "10.0.0.1" })).toBe("a:10.0.0.1");
    });

    it("ne confond jamais un compte et une adresse", () => {
        expect(keyOf({ user: { userId: 42 } })).not.toBe(keyOf({ ip: "42" }));
    });
});
