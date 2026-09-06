"use strict";

const bcrypt = require("bcrypt");

const passwordService = require("../../src/services/passwordService");

describe("passwordService", () => {
    it("stocke les nouveaux mots de passe avec Argon2id", async () => {
        const hash = await passwordService.hash("une phrase de passe suffisamment longue");
        expect(hash).toMatch(/^\$argon2id\$/);
        await expect(passwordService.verify(hash, "une phrase de passe suffisamment longue")).resolves.toBe(true);
        await expect(passwordService.verify(hash, "incorrect")).resolves.toBe(false);
    });

    it("accepte un hash bcrypt existant et demande sa migration", async () => {
        const legacy = await bcrypt.hash("mot de passe historique", 10);
        await expect(passwordService.verify(legacy, "mot de passe historique")).resolves.toBe(true);
        expect(passwordService.needsRehash(legacy)).toBe(true);
    });

    it("résiste à l'énumération temporelle même si le compte n'existe pas", async () => {
        await expect(passwordService.verifyUnknown("quelque chose")).resolves.toBe(false);
    });
});
