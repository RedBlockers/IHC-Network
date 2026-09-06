import assert from "node:assert/strict";
import test from "node:test";

import { splitReferences, openTarget, EDITORS } from "../src/lib/codeReferences.js";

test("reconnaît un fichier et sa ligne", () => {
    const parts = splitReferences("regarde src/lib/outbox.js:42 pour comprendre");

    assert.equal(parts.length, 3);
    assert.deepEqual(parts[1].reference, { path: "src/lib/outbox.js", line: 42, column: null });
    assert.equal(parts[0].text, "regarde ");
    assert.equal(parts[2].text, " pour comprendre");
});

test("reconnaît la colonne quand elle est donnée", () => {
    const [part] = splitReferences("app.jsx:120:8");
    assert.deepEqual(part.reference, { path: "app.jsx", line: 120, column: 8 });
});

test("ne prend pas une heure pour une référence", () => {
    const parts = splitReferences("la taverne ouvre à 18:42 ce soir");
    assert.equal(parts.length, 1);
    assert.equal(parts[0].reference, undefined);
});

test("ne prend ni un ratio ni une version pour une référence", () => {
    for (const texte of ["contraste 4.5:1", "version 2.0.0:1", "ratio 3:1"]) {
        const parts = splitReferences(texte);
        assert.equal(parts.filter((part) => part.reference).length, 0, texte);
    }
});

test("exige une extension connue", () => {
    assert.equal(splitReferences("dossier/chose:42").filter((p) => p.reference).length, 0);
    assert.equal(splitReferences("dossier/chose.js:42").filter((p) => p.reference).length, 1);
});

test("trouve plusieurs références dans un même message", () => {
    const parts = splitReferences("compare src/a.js:1 et src/b.ts:2");
    assert.equal(parts.filter((part) => part.reference).length, 2);
});

test("l'éditeur reçoit un chemin absolu, jamais relatif", () => {
    const cible = openTarget({ path: "src/a.js", line: 12, column: null }, { editor: "vscode", root: "/home/ada/projet" });
    assert.equal(cible.value, "vscode://file//home/ada/projet/src/a.js:12");
});

test("Neovim rend une commande, pas un lien mort", () => {
    const cible = openTarget({ path: "src/a.js", line: 12 }, { editor: "neovim", root: "/w" });
    assert.equal(cible.kind, "command");
    assert.equal(cible.value, "nvim +12 /w/src/a.js");
});

test("sans éditeur choisi, aucun lien n'est proposé", () => {
    assert.equal(openTarget({ path: "a.js", line: 1 }, { editor: "aucun" }), null);
    assert.equal(openTarget({ path: "a.js", line: 1 }), null);
});

test("chaque éditeur proposé sait ouvrir ou copier", () => {
    for (const editor of Object.values(EDITORS)) {
        if (editor.id === "aucun") continue;
        assert.ok(editor.url || editor.command, `${editor.id} ne sait rien faire`);
    }
});
