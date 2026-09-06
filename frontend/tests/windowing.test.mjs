import assert from "node:assert/strict";
import test from "node:test";

import { WINDOW_SIZE, grow, hiddenBefore, windowOf } from "../src/lib/windowing.js";

const list = (n) => Array.from({ length: n }, (_, i) => i);

test("une liste courte est rendue en entier", () => {
    assert.deepEqual(windowOf(list(10)), list(10));
    assert.equal(hiddenBefore(list(10)), 0);
});

test("une liste longue est bornée à la fenêtre", () => {
    const shown = windowOf(list(500));
    assert.equal(shown.length, WINDOW_SIZE);
});

test("la fenêtre s'ancre sur la fin, pas sur le début", () => {
    const shown = windowOf(list(500));
    assert.equal(shown.at(-1), 499);
    assert.equal(shown[0], 500 - WINDOW_SIZE);
});

test("le nombre d'éléments masqués est exact", () => {
    assert.equal(hiddenBefore(list(500)), 500 - WINDOW_SIZE);
});

test("agrandir la fenêtre ne dépasse jamais la liste", () => {
    assert.equal(grow(60, 80), 80);
    assert.equal(grow(60, 500), 100);
});

test("agrandir jusqu'au bout finit par tout montrer", () => {
    let size = WINDOW_SIZE;
    const total = 200;
    for (let i = 0; i < 20; i += 1) size = grow(size, total);

    assert.equal(size, total);
    assert.equal(hiddenBefore(list(total), size), 0);
});

test("une entrée absente ne casse rien", () => {
    assert.deepEqual(windowOf(null), []);
    assert.deepEqual(windowOf(undefined), []);
    assert.equal(hiddenBefore(null), 0);
});

test("une liste exactement de la taille de la fenêtre n'est pas coupée", () => {
    assert.equal(windowOf(list(WINDOW_SIZE)).length, WINDOW_SIZE);
    assert.equal(hiddenBefore(list(WINDOW_SIZE)), 0);
});
