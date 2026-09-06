import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

test("une communauté ne peut agir que par les quatre tokens prévus", () => {
    const tokens = readFileSync(new URL("../src/styles/tokens.css", import.meta.url), "utf8");
    const declared = [...tokens.matchAll(/--com-([\w-]+):/g)].map((m) => m[1]);

    assert.deepEqual(
        [...new Set(declared)].sort(),
        ["accent", "accent-2", "radius-delta", "surface-tint"]
    );
});
