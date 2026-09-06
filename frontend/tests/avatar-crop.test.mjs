import assert from "node:assert/strict";
import test from "node:test";

import { clampCropOffset, coverScale, cropSourceRect } from "../src/lib/avatarCrop.js";

test("une image paysage couvre toujours le cadre carré", () => {
    assert.equal(coverScale(1200, 800, 320, 1), 0.4);
    assert.ok(Math.abs(coverScale(1200, 800, 320, 1.5) - 0.6) < Number.EPSILON);
});

test("le déplacement ne peut jamais découvrir le fond du cadre", () => {
    const scale = coverScale(1200, 800, 320, 1);
    assert.deepEqual(clampCropOffset({ x: 500, y: -40 }, 1200, 800, 320, scale), { x: 80, y: 0 });
});

test("le rectangle source correspond exactement au cadrage affiché", () => {
    const scale = coverScale(1200, 800, 320, 1);
    assert.deepEqual(cropSourceRect(1200, 800, 320, scale, { x: 80, y: 0 }), {
        left: 0,
        top: 0,
        width: 800,
        height: 800,
    });
});
