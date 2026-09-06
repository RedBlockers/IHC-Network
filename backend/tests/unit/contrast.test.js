"use strict";

const { readFileSync } = require("node:fs");
const path = require("node:path");

const contrast = require("../../src/domain/contrast");

describe("Contrôle de contraste", () => {
    it("calcule le rapport selon la formule WCAG", () => {
        expect(Math.round(contrast.contrastRatio("#ffffff", "#000000"))).toBe(21);
        expect(Math.round(contrast.contrastRatio("#000000", "#000000"))).toBe(1);
    });

    it("corrige une teinte trop sombre ou trop claire au lieu de la refuser", () => {
        const tooDark = contrast.auditAccent("#0a1a14");
        expect(tooDark.passes).toBe(true);

        const dark = tooDark.checks.find((c) => c.label === "sombre");
        expect(dark.corrected).toBe(true);
        expect(dark.ratio).toBeGreaterThanOrEqual(tooDark.target);
    });

    it("annonce la couleur réellement employée sur chaque thème", () => {
        const audit = contrast.auditAccent("#12b5a2");
        const dark = audit.checks.find((c) => c.label === "sombre");
        const light = audit.checks.find((c) => c.label === "clair");

        expect(dark.applied).toBe("#12b5a2");
        expect(light.corrected).toBe(true);
        expect(light.ratio).toBeGreaterThanOrEqual(audit.target);
    });

    it("accepte l'accent par défaut", () => {
        expect(contrast.auditAccent("#12b5a2").passes).toBe(true);
    });

    it("garde la teinte perçue en corrigeant", () => {
        const audit = contrast.auditAccent("#12b5a2");
        const light = audit.checks.find((c) => c.label === "clair");
        const before = contrast.toOklch("#12b5a2");
        const after = contrast.toOklch(light.applied);
        expect(Math.abs(before.h - after.h)).toBeLessThan(6);
    });

    it("garde la même liste de fonctions que la copie cliente", () => {
        const client = readFileSync(
            path.join(__dirname, "../../../frontend/src/lib/contrast.js"),
            "utf8"
        );
        for (const name of ["relativeLuminance", "contrastRatio", "correctForContrast", "auditPair", "toOklch"]) {
            expect(client).toContain(`function ${name}`);
            expect(typeof contrast[name]).toBe("function");
        }
    });
});
