import assert from "node:assert/strict";
import test from "node:test";

import { moved } from "../src/lib/reorder.js";

test("descendre un élément d'un rang", () => {
    assert.deepEqual(moved(["a", "b", "c"], 0, 1), ["b", "a", "c"]);
});

test("monter un élément d'un rang", () => {
    assert.deepEqual(moved(["a", "b", "c"], 2, 1), ["a", "c", "b"]);
});

test("déplacer du début à la fin", () => {
    assert.deepEqual(moved(["a", "b", "c"], 0, 2), ["b", "c", "a"]);
});

test("déplacer de la fin au début", () => {
    assert.deepEqual(moved(["a", "b", "c"], 2, 0), ["c", "a", "b"]);
});

test("une cible hors bornes rend la liste telle quelle", () => {
    const list = ["a", "b", "c"];
    assert.equal(moved(list, 0, -1), list);
    assert.equal(moved(list, 0, 3), list);
    assert.equal(moved(list, 5, 0), list);
});

test("déplacer sur soi-même ne change rien", () => {
    const list = ["a", "b", "c"];
    assert.equal(moved(list, 1, 1), list);
});

test("la liste reçue n'est jamais modifiée", () => {
    const list = ["a", "b", "c"];
    moved(list, 0, 2);
    assert.deepEqual(list, ["a", "b", "c"]);
});
