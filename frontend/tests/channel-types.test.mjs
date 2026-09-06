import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import { CHANNEL_GROUPS, CHANNEL_TYPES, PRIMARY_CHANNEL_TYPE_IDS, channelTypeOf } from "../src/lib/channelTypes.js";

const serverTypes = (() => {
    const source = readFileSync(new URL("../../backend/src/domain/channelModes.js", import.meta.url), "utf8");
    return [...source.matchAll(/^\s{4}(\w+): \{$|^\s{4}(\w+): \{ id:/gm)]
        .map((match) => match[1] ?? match[2])
        .filter(Boolean);
})();

test("chaque type proposé à l'écran existe côté serveur", () => {
    for (const type of CHANNEL_TYPES) {
        assert.ok(serverTypes.includes(type.id), `type inconnu du serveur : ${type.id}`);
    }
});

test("chaque type du serveur est proposé à l'écran", () => {
    for (const id of serverTypes) {
        assert.ok(CHANNEL_TYPES.some((type) => type.id === id), `type non proposé : ${id}`);
    }
});

test("aucun type n'est proposé deux fois", () => {
    const ids = CHANNEL_TYPES.map((type) => type.id);
    assert.equal(new Set(ids).size, ids.length);
});

test("chaque type porte un libellé et une note", () => {
    for (const type of CHANNEL_TYPES) {
        assert.ok(type.label?.length > 0, `libellé manquant : ${type.id}`);
        assert.ok(type.note?.length > 0, `note manquante : ${type.id}`);
        assert.ok(type.icon?.length > 0, `icône manquante : ${type.id}`);
    }
});

test("les groupes ne se chevauchent pas", () => {
    const seen = new Set();
    for (const group of CHANNEL_GROUPS) {
        for (const type of group.types) {
            assert.ok(!seen.has(type.id), `type dans deux groupes : ${type.id}`);
            seen.add(type.id);
        }
    }
});

test("un type inconnu retombe sur le premier plutôt que de casser", () => {
    assert.equal(channelTypeOf("inexistant").id, CHANNEL_TYPES[0].id);
});

test("les types primaires restent un sous-ensemble du catalogue", () => {
    for (const id of PRIMARY_CHANNEL_TYPE_IDS) {
        assert.ok(CHANNEL_TYPES.some((type) => type.id === id), id);
    }
});
