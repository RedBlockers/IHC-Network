import assert from "node:assert/strict";
import test from "node:test";

import { FORMATS, TOOLBAR_ORDER, activeFormats, applyFormat, shortcutFor } from "../src/lib/markdownFormat.js";
import { groupChannelsByCategory, UNCATEGORIZED_LABEL } from "../src/lib/channels.js";

test("un style se coche avant d'écrire : les marqueurs entourent le curseur", () => {
    const result = applyFormat("", 0, 0, "bold");
    assert.equal(result.value, "****");
    assert.equal(result.selectionStart, 2);
    assert.equal(result.selectionEnd, 2);
});

test("un style s'applique à la sélection en cours", () => {
    const result = applyFormat("la taverne ouvre", 3, 10, "bold");
    assert.equal(result.value, "la **taverne** ouvre");
    assert.equal(result.value.slice(result.selectionStart, result.selectionEnd), "taverne");
});

test("réappliquer un style le retire", () => {
    const applied = applyFormat("la taverne", 3, 10, "italic");
    assert.equal(applied.value, "la *taverne*");
    const removed = applyFormat(applied.value, applied.selectionStart, applied.selectionEnd, "italic");
    assert.equal(removed.value, "la taverne");
    assert.equal(removed.value.slice(removed.selectionStart, removed.selectionEnd), "taverne");
});

test("l'italique ne se déclenche pas sur les astérisques d'un gras", () => {
    const text = "**taverne**";
    assert.equal(activeFormats(text, 2, 9).has("bold"), true);
    assert.equal(activeFormats(text, 2, 9).has("italic"), false);
});

test("la citation, les listes et le bloc de code portent sur les lignes sélectionnées", () => {
    const text = "une\ndeux";
    const quoted = applyFormat(text, 0, text.length, "quote");
    assert.equal(quoted.value, "> une\n> deux");
    assert.equal(activeFormats(quoted.value, 0, quoted.value.length).has("quote"), true);

    const unquoted = applyFormat(quoted.value, 0, quoted.value.length, "quote");
    assert.equal(unquoted.value, text);

    const ordered = applyFormat(text, 0, text.length, "ordered");
    assert.equal(ordered.value, "1. une\n2. deux");
    assert.equal(applyFormat(ordered.value, 0, ordered.value.length, "ordered").value, text);

    const fenced = applyFormat(text, 0, text.length, "codeblock");
    assert.equal(fenced.value, "```\nune\ndeux\n```");
    assert.equal(activeFormats(fenced.value, fenced.selectionStart, fenced.selectionEnd).has("codeblock"), true);
});

test("le lien place le curseur sur l'adresse à compléter", () => {
    const result = applyFormat("voir taverne", 5, 12, "link");
    assert.equal(result.value, "voir [taverne](url)");
    assert.equal(result.value.slice(result.selectionStart, result.selectionEnd), "url");

    const undone = applyFormat(result.value, 5, result.value.length, "link");
    assert.equal(undone.value, "voir taverne");
});

test("le spoiler et le code en ligne existent dans la barre", () => {
    assert.equal(applyFormat("secret", 0, 6, "spoiler").value, "||secret||");
    assert.equal(applyFormat("npm", 0, 3, "code").value, "`npm`");
    assert.equal(applyFormat("faux", 0, 4, "strike").value, "~~faux~~");
    assert.equal(TOOLBAR_ORDER.length, Object.keys(FORMATS).length);
});

test("les raccourcis clavier n'agissent qu'avec la touche de commande", () => {
    assert.equal(shortcutFor({ ctrlKey: true, metaKey: false, key: "b" }), "bold");
    assert.equal(shortcutFor({ ctrlKey: false, metaKey: true, key: "K" }), "link");
    assert.equal(shortcutFor({ ctrlKey: false, metaKey: false, key: "b" }), null);
});

test("les salons sans catégorie restent visibles en dernier", () => {
    const groups = groupChannelsByCategory(
        [{ categoryId: 5, name: "ROYAUME", position: 2 }],
        [
            { channelId: 2, categoryId: null, position: 1 },
            { channelId: 1, categoryId: 5, position: 0 },
        ]
    );
    assert.equal(groups.length, 2);
    assert.equal(groups[0].name, "ROYAUME");
    assert.equal(groups[1].name, UNCATEGORIZED_LABEL);
    assert.equal(groups[1].channels[0].channelId, 2);
});

test("une catégorie vide reste un emplacement visible", () => {
    const groups = groupChannelsByCategory([{ categoryId: 5, name: "VIDE", position: 1 }], []);
    assert.deepEqual(groups, [{ categoryId: 5, name: "VIDE", position: 1, channels: [] }]);
});
