"use strict";

const totp = require("../../src/domain/totp");

const RFC_SECRET = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";

describe("TOTP", () => {
    describe("Conformité RFC 6238", () => {
        test.each([
            [59, "287082"],
            [1111111109, "081804"],
            [1111111111, "050471"],
            [1234567890, "005924"],
            [2000000000, "279037"],
        ])("à %i secondes, le code est %s", (seconds, expected) => {
            const counter = Math.floor(seconds / totp.STEP_SECONDS);
            expect(totp.codeAt(RFC_SECRET, counter)).toBe(expected);
        });
    });

    describe("Vérification", () => {
        test("accepte le code du pas courant", () => {
            const now = 1_700_000_000_000;
            const counter = Math.floor(now / 1000 / totp.STEP_SECONDS);
            const code = totp.codeAt(RFC_SECRET, counter);

            expect(totp.verify(RFC_SECRET, code, { now })).toBe(counter);
        });

        test("tolère une horloge en retard ou en avance d'un pas", () => {
            const now = 1_700_000_000_000;
            const counter = Math.floor(now / 1000 / totp.STEP_SECONDS);

            expect(totp.verify(RFC_SECRET, totp.codeAt(RFC_SECRET, counter - 1), { now })).toBe(counter - 1);
            expect(totp.verify(RFC_SECRET, totp.codeAt(RFC_SECRET, counter + 1), { now })).toBe(counter + 1);
        });

        test("refuse au-delà de la tolérance", () => {
            const now = 1_700_000_000_000;
            const counter = Math.floor(now / 1000 / totp.STEP_SECONDS);

            expect(totp.verify(RFC_SECRET, totp.codeAt(RFC_SECRET, counter + 2), { now })).toBeNull();
        });

        test("refuse ce qui n'a pas la forme d'un code", () => {
            expect(totp.verify(RFC_SECRET, "12345")).toBeNull();
            expect(totp.verify(RFC_SECRET, "abcdef")).toBeNull();
            expect(totp.verify(RFC_SECRET, "")).toBeNull();
            expect(totp.verify(RFC_SECRET, null)).toBeNull();
        });

        test("tolère les espaces de recopie", () => {
            const now = 1_700_000_000_000;
            const counter = Math.floor(now / 1000 / totp.STEP_SECONDS);
            const code = totp.codeAt(RFC_SECRET, counter);

            expect(totp.verify(RFC_SECRET, `${code.slice(0, 3)} ${code.slice(3)}`, { now })).toBe(counter);
        });
    });

    describe("Secrets", () => {
        test("un secret généré est lisible par une application d'authentification", () => {
            const secret = totp.generateSecret();

            expect(secret).toMatch(/^[A-Z2-7]+$/);
            expect(secret.length).toBeGreaterThanOrEqual(32);
        });

        test("deux secrets ne se ressemblent pas", () => {
            expect(totp.generateSecret()).not.toBe(totp.generateSecret());
        });

        test("l'encodage base32 fait l'aller-retour", () => {
            const original = Buffer.from("un secret quelconque");
            expect(totp.decodeBase32(totp.encodeBase32(original))).toEqual(original);
        });

        test("le rembourrage et les espaces sont tolérés au décodage", () => {
            expect(totp.decodeBase32("GEZD GNBV GY3T QOJQ")).toEqual(totp.decodeBase32("GEZDGNBVGY3TQOJQ"));
            expect(totp.decodeBase32("GEZDGNBV====")).toEqual(totp.decodeBase32("GEZDGNBV"));
        });

        test("un secret illisible échoue franchement", () => {
            expect(() => totp.decodeBase32("018!")).toThrow(/invalide/i);
        });
    });

    describe("URI de configuration", () => {
        test("porte l'émetteur, la période et le nombre de chiffres", () => {
            const uri = totp.provisioningUri("GEZDGNBVGY3TQOJQ", { account: "alice" });

            expect(uri).toContain("otpauth://totp/Qweillo%3Aalice");
            expect(uri).toContain("issuer=Qweillo");
            expect(uri).toContain("period=30");
            expect(uri).toContain("digits=6");
        });

        test("échappe un identifiant qui contient un séparateur", () => {
            const uri = totp.provisioningUri("GEZDGNBVGY3TQOJQ", { account: "a:b/c" });

            expect(uri).not.toContain("a:b/c");
        });
    });
});
