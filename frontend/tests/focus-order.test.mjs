import assert from "node:assert/strict";
import test from "node:test";

import { focusOrder } from "../src/lib/focusOrder.js";

const tile = (identity, extra = {}) => ({ identity, isSpeaking: false, isScreenShare: false, ...extra });

test("qui parle passe devant qui se tait", () => {
    const order = focusOrder([tile("a"), tile("b", { isSpeaking: true })], {});
    assert.deepEqual(order.map((t) => t.identity), ["b", "a"]);
});

test("le partage d'écran garde la vedette même quand quelqu'un parle", () => {
    const order = focusOrder([tile("a", { isSpeaking: true }), tile("b", { isScreenShare: true })], {});
    assert.equal(order[0].identity, "b");
});

test("une main levée passe devant le silence, mais derrière la parole", () => {
    const order = focusOrder(
        [tile("a"), tile("b", { isSpeaking: true }), tile("c")],
        { c: Date.now() }
    );
    assert.deepEqual(order.map((t) => t.identity), ["b", "c", "a"]);
});

test("à rang égal, l'ordre d'arrivée est conservé", () => {
    const order = focusOrder([tile("a"), tile("b"), tile("c")], {});
    assert.deepEqual(order.map((t) => t.identity), ["a", "b", "c"]);
});

test("personne n'est retiré de l'affichage", () => {
    const tiles = [tile("a"), tile("b", { isSpeaking: true }), tile("c")];
    assert.equal(focusOrder(tiles, {}).length, tiles.length);
});

test("la liste reçue n'est pas modifiée", () => {
    const tiles = [tile("a"), tile("b", { isSpeaking: true })];
    focusOrder(tiles, {});
    assert.equal(tiles[0].identity, "a");
});
