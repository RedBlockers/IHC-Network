import test from "node:test";
import assert from "node:assert/strict";
import { safeReturnPath } from "../src/lib/returnPath.js";

test("reprend un parcours interne après connexion", () => {
    assert.equal(
        safeReturnPath("?returnTo=" + encodeURIComponent("/invite/atelier?source=lien#accueil")),
        "/invite/atelier?source=lien#accueil"
    );
    assert.equal(safeReturnPath(""), "/");
});

test("une adresse de retour ne peut pas changer d’origine", () => {
    for (const target of [
        "https://external.example",
        "//external.example",
        "/\\external.example",
        "/\n/external.example",
        "/\t/external.example",
    ]) {
        assert.equal(safeReturnPath("?returnTo=" + encodeURIComponent(target)), "/");
    }
});
