import assert from "node:assert/strict";
import test from "node:test";

import { parseUnifiedDiff, diffStats } from "../src/lib/diff.js";

const PATCH = `diff --git a/src/auth.js b/src/auth.js
index 3f2a1b0..9c4d2e1 100644
--- a/src/auth.js
+++ b/src/auth.js
@@ -10,4 +10,5 @@ function login() {
 const user = find(handle);
-if (!user) return null;
+if (!user) throw new NotFound();
+audit(user);
 return user;
 }
\\ No newline at end of file
`;

test("numérote les lignes de chaque côté à partir de l'en-tête du hunk", () => {
    const { files } = parseUnifiedDiff(PATCH);
    assert.equal(files.length, 1);
    assert.equal(files[0].newPath, "src/auth.js");
    const [hunk] = files[0].hunks;
    assert.equal(hunk.header, "function login() {");
    assert.deepEqual(
        hunk.lines.map((line) => [line.type, line.oldNo, line.newNo]),
        [
            ["ctx", 10, 10],
            ["del", 11, null],
            ["add", null, 11],
            ["add", null, 12],
            ["ctx", 12, 13],
            ["ctx", 13, 14],
        ]
    );
});

test("compte les ajouts et les retraits", () => {
    assert.deepEqual(diffStats(PATCH), { added: 2, removed: 1 });
});

test("un extrait sans en-tête reste lisible comme contexte", () => {
    const { files } = parseUnifiedDiff("const a = 1;\nconst b = 2;");
    assert.equal(files.length, 1);
    assert.equal(files[0].hunks[0].lines.length, 2);
    assert.equal(files[0].hunks[0].lines[1].text, "const b = 2;");
});

test("un patch vide ne produit aucun fichier", () => {
    assert.deepEqual(parseUnifiedDiff(""), { files: [] });
    assert.deepEqual(parseUnifiedDiff(null), { files: [] });
});
