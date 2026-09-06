import assert from "node:assert/strict";
import test from "node:test";

import { SHORTCUTS, matches, resolve } from "../src/lib/shortcuts.js";

const press = (key, mods = {}) => ({
    key,
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    ...mods,
});

test("la table reprend les six raccourcis de référence", () => {
    assert.deepEqual(
        SHORTCUTS.map((s) => s.hint),
        ["⌘K", "⌘⇧M", "Alt ⇧ ↓", "⌘I", "R", "Échap"]
    );
});

test("une combinaison exacte est reconnue", () => {
    assert.equal(resolve(press("k", { metaKey: true }))?.id, "palette");
    assert.equal(resolve(press("i", { ctrlKey: true }))?.id, "inbox");
});

test("un modificateur en trop ne déclenche pas", () => {
    assert.equal(resolve(press("k", { metaKey: true, shiftKey: true })), null);
});

test("les combinaisons voisines restent distinctes", () => {
    assert.equal(resolve(press("m", { metaKey: true, shiftKey: true }))?.id, "microphone");
    assert.equal(resolve(press("m", { metaKey: true })), null);
});

test("pendant une saisie, les touches nues appartiennent au champ", () => {
    assert.equal(resolve(press("r"), { typing: true }), null);
    assert.equal(resolve(press("Escape"), { typing: true }), null);
});

test("pendant une saisie, les combinaisons à modificateur passent quand même", () => {
    assert.equal(resolve(press("k", { metaKey: true }), { typing: true })?.id, "palette");
    assert.equal(resolve(press("arrowdown", { altKey: true, shiftKey: true }), { typing: true })?.id, "next-unread");
});

test("la casse de la touche n'a pas d'importance", () => {
    assert.equal(resolve(press("K", { metaKey: true }))?.id, "palette");
});

test("chaque raccourci porte un libellé lisible", () => {
    for (const shortcut of SHORTCUTS) {
        assert.ok(shortcut.label?.length > 0, `libellé manquant : ${shortcut.id}`);
        assert.ok(shortcut.hint?.length > 0, `indication manquante : ${shortcut.id}`);
    }
});

test("aucune combinaison n'est définie deux fois", () => {
    const seen = new Set();
    for (const { keys } of SHORTCUTS) {
        const signature = `${keys.mod ? "m" : ""}${keys.shift ? "s" : ""}${keys.alt ? "a" : ""}:${keys.key}`;
        assert.ok(!seen.has(signature), `combinaison en double : ${signature}`);
        seen.add(signature);
    }
});

test("matches n'accepte pas une combinaison partielle", () => {
    assert.equal(matches(press("arrowdown", { altKey: true }), { alt: true, shift: true, key: "arrowdown" }), false);
});
