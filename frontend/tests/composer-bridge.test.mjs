import assert from "node:assert/strict";
import test from "node:test";

import { connectComposer, insertIntoComposer } from "../src/lib/composerBridge.js";

test("le texte arrive à la zone branchée", () => {
    const seen = [];
    const stop = connectComposer((text) => seen.push(text));

    assert.equal(insertIntoComposer("@alice "), true);
    assert.deepEqual(seen, ["@alice "]);
    stop();
});

test("sans zone branchée, il ne se passe rien et on le sait", () => {
    assert.equal(insertIntoComposer("@alice "), false);
});

test("se débrancher coupe la réception", () => {
    const seen = [];
    const stop = connectComposer((text) => seen.push(text));
    stop();

    insertIntoComposer("@bob ");
    assert.deepEqual(seen, []);
});

test("la dernière zone branchée reçoit, pas les précédentes", () => {
    const first = [];
    const second = [];
    connectComposer((text) => first.push(text));
    const stopSecond = connectComposer((text) => second.push(text));

    insertIntoComposer("@carla ");

    assert.deepEqual(first, []);
    assert.deepEqual(second, ["@carla "]);
    stopSecond();
});

test("un débranchement tardif ne coupe pas la zone suivante", () => {
    const seen = [];
    const stopFirst = connectComposer(() => {});
    connectComposer((text) => seen.push(text));

    stopFirst();
    insertIntoComposer("@dan ");

    assert.deepEqual(seen, ["@dan "]);
});
