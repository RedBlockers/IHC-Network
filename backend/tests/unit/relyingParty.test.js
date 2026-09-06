"use strict";

const relyingParty = require("../../src/domain/relyingParty");
const config = require("../../src/config");

describe("Identité du site pour WebAuthn", () => {
    it("ne tire son domaine que de la configuration", () => {
        expect(relyingParty.rpId()).toBe(new URL(config.CORS_ORIGIN[0]).hostname);
    });

    it("écrit le domaine sans son port", () => {
        expect(relyingParty.rpId()).not.toMatch(/:/);
    });

    it("accepte les origines déjà déclarées, sans doublon", () => {
        const origins = relyingParty.origins();
        expect(origins).toContain(config.CORS_ORIGIN[0]);
        expect(new Set(origins).size).toBe(origins.length);
    });
});
