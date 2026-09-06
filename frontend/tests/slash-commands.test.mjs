import assert from "node:assert/strict";
import test from "node:test";

import { COMMANDS, parse, suggest } from "../src/lib/slashCommands.js";

test("une commande connue est reconnue", () => {
    assert.equal(parse("/aide")?.command.name, "aide");
});

test("les arguments sont séparés du nom", () => {
    const result = parse("/moi prépare le café");
    assert.equal(result.command.name, "moi");
    assert.equal(result.args, "prépare le café");
});

test("un texte qui commence par une barre sans commande connue reste un message", () => {
    assert.equal(parse("/me sens fatigué"), null);
    assert.equal(parse("/chemin/vers/fichier"), null);
});

test("une commande qui exige un argument signale son manque", () => {
    const result = parse("/moi");
    assert.equal(result.missingArgs, true);
    assert.equal(parse("/moi danse").missingArgs, false);
});

test("une commande sans argument n'en réclame pas", () => {
    assert.equal(parse("/aide").missingArgs, false);
});

test("rien n'est proposé tant qu'on n'a pas tapé la barre", () => {
    assert.deepEqual(suggest("bonjour"), []);
    assert.ok(suggest("/").length > 0);
});

test("les propositions se filtrent à la frappe", () => {
    const names = suggest("/s").map((c) => c.name);
    assert.ok(names.includes("sondage"));
    assert.ok(names.includes("silence"));
    assert.ok(!names.includes("aide"));
});

test("une commande interdite n'est pas proposée", () => {
    assert.ok(!suggest("/e").some((c) => c.name === "epingler"));
    assert.ok(suggest("/e", { permissions: ["MANAGE_MESSAGES"] }).some((c) => c.name === "epingler"));
});

test("plus rien n'est proposé une fois un argument commencé", () => {
    assert.deepEqual(suggest("/moi danse"), []);
});

test("chaque commande porte un résumé lisible", () => {
    for (const command of COMMANDS) {
        assert.ok(command.summary?.length > 0, `résumé manquant : ${command.name}`);
        assert.ok(/^[a-zà-ÿ]+$/i.test(command.name), `nom non typable : ${command.name}`);
    }
});
