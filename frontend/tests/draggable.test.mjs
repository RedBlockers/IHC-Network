import assert from "node:assert/strict";
import test from "node:test";

import { MARGIN, clamp } from "../src/hooks/useDraggable.js";

const withWindow = (width, height, run) => {
    globalThis.window = { innerWidth: width, innerHeight: height };
    try {
        return run();
    } finally {
        delete globalThis.window;
    }
};

test("une position à l'intérieur est conservée", () => {
    withWindow(1200, 800, () => {
        assert.deepEqual(clamp({ x: 300, y: 200 }, { width: 300, height: 100 }), { x: 300, y: 200 });
    });
});

test("une position au-delà du bord droit est ramenée", () => {
    withWindow(1200, 800, () => {
        const { x } = clamp({ x: 5000, y: 100 }, { width: 300, height: 100 });
        assert.equal(x, 1200 - 300 - MARGIN);
    });
});

test("une position négative est ramenée à la marge", () => {
    withWindow(1200, 800, () => {
        assert.deepEqual(clamp({ x: -500, y: -500 }, { width: 300, height: 100 }), { x: MARGIN, y: MARGIN });
    });
});

test("un panneau plus large que la fenêtre reste attrapable", () => {
    withWindow(280, 400, () => {
        const { x, y } = clamp({ x: 999, y: 999 }, { width: 400, height: 500 });
        assert.equal(x, MARGIN);
        assert.equal(y, MARGIN);
    });
});

test("le bord bas est borné comme le bord droit", () => {
    withWindow(1200, 800, () => {
        const { y } = clamp({ x: 10, y: 5000 }, { width: 300, height: 120 });
        assert.equal(y, 800 - 120 - MARGIN);
    });
});
