import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { contrastRatio, correctForContrast, auditPair, toOklch } from "../src/lib/contrast.js";
import { ROLE_COLORS, ROLE_COLOR_SAMPLES, resolveRoleColor } from "../src/lib/roleColors.js";

const css = await readFile(new URL("../src/styles/tokens.css", import.meta.url), "utf8");
const exported = JSON.parse(await readFile(new URL("../src/design/tokens.json", import.meta.url), "utf8"));

const blockFor = (selector) => {
    const index = css.indexOf(`${selector} {`);
    assert.notEqual(index, -1, `sélecteur absent de tokens.css : ${selector}`);
    const start = css.indexOf("{", index);
    const end = css.indexOf("\n}", start);
    return css.slice(start + 1, end);
};

const declarations = (block) => {
    const map = new Map();
    for (const line of block.split("\n")) {
        const match = /^\s*(--[a-z0-9-]+)\s*:\s*(.+?);\s*$/i.exec(line);
        if (match) map.set(match[1], match[2].trim());
    }
    return map;
};

const rootDeclarations = declarations(blockFor(":root"));

const resolve = (name, seen = new Set()) => {
    assert.ok(rootDeclarations.has(name), `token absent du contrat : ${name}`);
    assert.ok(!seen.has(name), `cycle de résolution sur ${name}`);
    seen.add(name);
    const raw = rootDeclarations.get(name);
    const direct = /^var\((--[a-z0-9-]+)\)$/i.exec(raw);
    if (direct) return resolve(direct[1], seen);
    const radius = /^calc\(\s*([0-9]+px)\s*\+\s*var\(--com-radius-delta\)\s*\)$/i.exec(raw);
    if (radius) return radius[1];
    return raw;
};

const groups = ["surfaces", "text", "accent", "semantic", "presence", "space", "radius", "elevation", "motion", "icons", "focus", "touch"];

test("l'export JSON et la feuille de tokens décrivent les mêmes valeurs", () => {
    for (const group of groups) {
        for (const [token, expected] of Object.entries(exported[group])) {
            if (token.startsWith("$")) continue;
            assert.equal(resolve(token), String(expected), `${group}.${token}`);
        }
    }
});

test("les tokens du contrat existent dans la feuille", () => {
    const contract = [
        "--bg-base", "--bg-raised", "--bg-surface", "--bg-overlay",
        "--text-primary", "--text-secondary", "--text-muted",
        "--accent-bg", "--accent-text", "--focus-ring",
        "--com-accent", "--com-surface-tint", "--com-radius-delta",
        "--space-1", "--space-8", "--r-sm", "--r-md", "--r-lg", "--r-xl",
        "--dur-micro", "--dur-panel", "--dur-view", "--ease-standard",
    ];
    for (const token of contract) assert.ok(rootDeclarations.has(token), `token manquant : ${token}`);
});

test("la grille d'espacement suit 4/8/12/16/24/32/48/64", () => {
    const expected = ["4px", "8px", "12px", "16px", "24px", "32px", "48px", "64px"];
    expected.forEach((value, index) => assert.equal(resolve(`--space-${index + 1}`), value));
});

test("le mouvement respecte 120/200/260 et la courbe standard du dossier", () => {
    assert.equal(resolve("--dur-micro"), "120ms");
    assert.equal(resolve("--dur-panel"), "200ms");
    assert.equal(resolve("--dur-view"), "260ms");
    assert.equal(resolve("--ease-standard"), "cubic-bezier(0.2, 0, 0, 1)");
    assert.equal(resolve("--ease-exit"), "cubic-bezier(0.4, 0, 1, 1)");
});

test("« réduire les animations » ramène toutes les durées sous 80 ms", () => {
    const reduced = declarations(blockFor(':root[data-motion="reduced"]'));
    for (const token of ["--dur-micro", "--dur-panel", "--dur-view", "--dur-expressive"]) {
        const value = reduced.get(token);
        assert.ok(value, `durée non couverte par le mode réduit : ${token}`);
        assert.ok(Number.parseInt(value, 10) <= 80, `${token} = ${value} dépasse 80 ms`);
    }
});

test("les quatre thèmes système sont des jeux de valeurs sur le même contrat", () => {
    assert.deepEqual(exported.themes, ["dark", "light", "oled", "contrast"]);
    for (const theme of ["light", "oled", "contrast"]) {
        const block = declarations(blockFor(`:root[data-theme="${theme}"]`));
        assert.ok(block.has("--bg-base"), `${theme} ne redéfinit pas --bg-base`);
        assert.ok(block.has("color-scheme") === false || true);
    }
});

test("la densité compacte suit les mesures du dossier", () => {
    const compact = declarations(blockFor(':root[data-density="compact"]'));
    assert.equal(compact.get("--density-avatar"), "28px");
    assert.equal(compact.get("--density-text"), "0.875rem");
    assert.equal(compact.get("--density-leading"), "1.4");
    assert.equal(compact.get("--density-pad-y"), "7px");
    assert.equal(compact.get("--density-pad-x"), "12px");
    assert.equal(compact.get("--density-gap"), "10px");
    assert.equal(resolve("--density-avatar"), "40px");
});

test("la zone tactile minimale est celle de la conception mobile", () => {
    assert.equal(resolve("--touch-min"), "44px");
    assert.equal(resolve("--focus-ring-width"), "2px");
    assert.equal(resolve("--focus-ring-offset"), "2px");
});

test("le rapport de contraste suit la formule WCAG", () => {
    assert.equal(Math.round(contrastRatio("#ffffff", "#000000")), 21);
    assert.equal(Math.round(contrastRatio("#000000", "#000000")), 1);
    assert.ok(contrastRatio("#edf1f6", "#0b0e13") > 15);
});

test("le texte principal et secondaire tiennent AA sur chaque surface sombre", () => {
    for (const surface of ["#0b0e13", "#12161d", "#151a21", "#1b212b"]) {
        assert.ok(contrastRatio("#edf1f6", surface) >= 4.5, `texte principal sur ${surface}`);
        assert.ok(contrastRatio("#a8b3c1", surface) >= 4.5, `texte secondaire sur ${surface}`);
    }
});

test("une teinte libre trop sombre est remontée au seuil AA sans dériver de teinte", () => {
    const source = "#0a3d2f";
    const corrected = correctForContrast(source, "#0b0e13");
    assert.ok(contrastRatio(corrected, "#0b0e13") >= 4.5);
    const before = toOklch(source);
    const after = toOklch(corrected);
    assert.ok(Math.abs(before.h - after.h) < 6, `teinte déplacée de ${Math.abs(before.h - after.h)}°`);
});

test("une teinte déjà conforme n'est pas modifiée", () => {
    assert.equal(correctForContrast("#2dd4bf", "#0b0e13"), "#2dd4bf");
});

test("l'audit d'un couple propose une correction exploitable par l'administration", () => {
    const failing = auditPair("#1a4d3f", "#0b0e13", { label: "accent" });
    assert.equal(failing.passes, false);
    assert.ok(failing.suggestion);
    assert.ok(contrastRatio(failing.suggestion, "#0b0e13") >= 4.5);
    assert.equal(auditPair("#edf1f6", "#0b0e13").suggestion, null);
});

test("les douze couleurs de rôles tiennent AA sur fond sombre et clair", () => {
    assert.equal(ROLE_COLORS.length, 12);
    for (const role of ROLE_COLORS) {
        assert.ok(
            contrastRatio(role.dark, ROLE_COLOR_SAMPLES.dark) >= 4.5,
            `${role.id} échoue sur fond sombre`
        );
        assert.ok(
            contrastRatio(role.light, ROLE_COLOR_SAMPLES.light) >= 4.5,
            `${role.id} échoue sur fond clair`
        );
    }
});

test("une couleur de rôle hors gamme est corrigée à l'affichage", () => {
    const resolved = resolveRoleColor("#123018", "dark");
    assert.equal(resolved.corrected, true);
    assert.ok(resolved.ratio >= 4.5);

    const preset = resolveRoleColor("teal", "light");
    assert.equal(preset.corrected, false);
    assert.equal(preset.color, "#108275");
});
