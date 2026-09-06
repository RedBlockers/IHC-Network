import assert from "node:assert/strict";
import test from "node:test";

import { rank, score } from "../src/lib/paletteScore.js";

test("le libellé qui commence par la saisie passe devant celui qui la contient", () => {
    const items = [
        { label: "Salon des annonces générales" },
        { label: "Général" },
    ];

    assert.equal(rank(items, "géné")[0].label, "Général");
});

test("un mot du libellé qui commence par la saisie passe devant une occurrence au milieu", () => {
    const items = [
        { label: "Rétrospective" },
        { label: "Salon rétro" },
    ];

    assert.equal(rank(items, "rétro")[0].label, "Rétrospective");
    assert.equal(rank(items, "rétro")[1].label, "Salon rétro");
});

test("les accents ne sont exigés d'aucun côté", () => {
    assert.notEqual(score("Général", "general"), null);
    assert.notEqual(score("General", "général"), null);
});

test("les lettres dans l'ordre suffisent, même séparées", () => {
    assert.notEqual(score("général", "gnl"), null);
    assert.equal(score("général", "lng"), null);
});

test("à pertinence égale, le libellé le plus court gagne", () => {
    const items = [
        { label: "Annonces importantes de la communauté" },
        { label: "Annonces" },
    ];

    assert.equal(rank(items, "annonces")[0].label, "Annonces");
});

test("ce qui ne correspond pas est écarté, pas classé dernier", () => {
    const items = [{ label: "Général" }, { label: "Vocal" }];

    assert.deepEqual(rank(items, "zzz"), []);
});

test("une saisie vide garde tout, dans l'ordre reçu", () => {
    const items = [{ label: "Général" }, { label: "Vocal" }];

    assert.deepEqual(rank(items, "").map((item) => item.label), ["Général", "Vocal"]);
});

test("le classement ne dépend pas de la casse", () => {
    assert.equal(score("Général", "GÉNÉ"), score("Général", "géné"));
});
