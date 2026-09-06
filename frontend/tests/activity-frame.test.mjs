import assert from "node:assert/strict";
import test from "node:test";

import { activityIframeSrc, activityReferrerPolicy, activitySandbox } from "../src/lib/activityFrame.js";

test("une activité signe le jeton dans le fragment", () => {
    const src = activityIframeSrc("https://jeu.example/app", "abc.def");
    assert.match(src, /#token=/);
    assert.doesNotMatch(src, /\?token=/);
    assert.equal(activitySandbox().includes("allow-same-origin"), false);
    assert.equal(activityReferrerPolicy(), "no-referrer");
    assert.throws(() => activityIframeSrc("http://jeu.example", "x"));
});
