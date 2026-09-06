import assert from "node:assert/strict";
import test from "node:test";

import { languageFromClass, normalizeLanguage, tokenize, SUPPORTED } from "../src/lib/codeHighlight.js";

const types = (code, lang) => tokenize(code, lang).map((s) => s.type);
const joined = (code, lang) => tokenize(code, lang).map((s) => s.value).join("");

test("le découpage ne perd ni ne réordonne jamais un caractère", () => {
    const samples = [
        ["const x = 1; // note", "js"],
        ["SELECT * FROM t WHERE a = 'b'", "sql"],
        ["def f():\n    return 1  # ok", "python"],
        ["echo \"salut\" # ici", "bash"],
        ["{\"a\": 1, \"b\": true}", "json"],
    ];
    for (const [code, lang] of samples) assert.equal(joined(code, lang), code);
});

test("reconnaît mots-clés, chaînes, nombres et commentaires", () => {
    const segments = tokenize('const total = 42; // somme', "js");
    const byType = Object.fromEntries(segments.map((s) => [s.type, s.value]));

    assert.equal(byType.keyword, "const");
    assert.equal(byType.number, "42");
    assert.equal(byType.comment, "// somme");
    assert.ok(tokenize('const s = "texte";', "js").some((s) => s.type === "string" && s.value === '"texte"'));
});

test("ne colore rien quand le langage est inconnu", () => {
    const segments = tokenize("const x = 1;", "brainfuck");
    assert.deepEqual(segments, [{ type: "plain", value: "const x = 1;" }]);
    assert.deepEqual(types("const x = 1;", ""), ["plain"]);
});

test("accepte les alias usuels", () => {
    assert.equal(normalizeLanguage("ts"), "typescript");
    assert.equal(normalizeLanguage("SH"), "bash");
    assert.equal(languageFromClass("language-jsx"), "javascript");
    assert.equal(languageFromClass(null), "");
    assert.ok(SUPPORTED.includes("sql"));
});

test("le dièse ouvre un commentaire en bash et en python, pas ailleurs", () => {
    assert.ok(tokenize("# titre", "python").some((s) => s.type === "comment"));
    assert.ok(!tokenize("#id { color: red }", "css").some((s) => s.type === "comment"));
});
