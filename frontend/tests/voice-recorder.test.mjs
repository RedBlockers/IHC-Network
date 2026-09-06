import assert from "node:assert/strict";
import test from "node:test";

import { MAX_SECONDS, isSupported, supportedMime } from "../src/lib/voiceRecorder.js";

test("sans MediaRecorder, rien n'est proposé", () => {
    delete globalThis.MediaRecorder;
    assert.equal(supportedMime(), null);
    assert.equal(isSupported(), false);
});

test("le format retenu est le premier supporté", () => {
    globalThis.MediaRecorder = { isTypeSupported: (mime) => mime === "audio/mp4" };
    assert.equal(supportedMime(), "audio/mp4");
    delete globalThis.MediaRecorder;
});

test("opus est préféré quand il est disponible", () => {
    globalThis.MediaRecorder = { isTypeSupported: () => true };
    assert.match(supportedMime(), /opus/);
    delete globalThis.MediaRecorder;
});

test("sans accès au micro, rien n'est proposé", () => {
    globalThis.MediaRecorder = { isTypeSupported: () => true };
    const original = Object.getOwnPropertyDescriptor(globalThis, "navigator");
    Object.defineProperty(globalThis, "navigator", { value: {}, configurable: true });

    assert.equal(isSupported(), false);

    if (original) Object.defineProperty(globalThis, "navigator", original);
    delete globalThis.MediaRecorder;
});

test("la durée est bornée", () => {
    assert.ok(MAX_SECONDS > 0 && MAX_SECONDS <= 600);
});
