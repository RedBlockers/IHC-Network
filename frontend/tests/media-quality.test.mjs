import assert from "node:assert/strict";
import test from "node:test";

import {
    SCREEN_CAPTURE,
    SCREEN_CAPTURE_UHD,
    deservesUhd,
    screenCaptureFor,
    screenEncodingFor,
} from "../src/lib/mediaQuality.js";

test("le partage d'écran peut monter en 4K", () => {
    assert.equal(screenCaptureFor({ uhd: true }).width, 3840);
    assert.equal(screenCaptureFor({}).width, SCREEN_CAPTURE.width);
});

test("le débit suit la définition", () => {
    assert.ok(screenEncodingFor({ uhd: true }).maxBitrate > screenEncodingFor({}).maxBitrate);
});

test("le 4K n'est proposé que si la source le justifie", () => {
    const source = (width) => ({ getSettings: () => ({ width, height: Math.round((width * 9) / 16) }) });

    assert.equal(deservesUhd(source(1920)), false);
    assert.equal(deservesUhd(source(2560)), false);
    assert.equal(deservesUhd(source(3840)), true);
});

test("une piste sans réglages ne déclenche pas le 4K", () => {
    assert.equal(deservesUhd(null), false);
    assert.equal(deservesUhd({}), false);
});

test("le profil de secours reste celui du partage ordinaire", () => {
    assert.notDeepEqual(SCREEN_CAPTURE, SCREEN_CAPTURE_UHD);
    assert.equal(SCREEN_CAPTURE.width, 2560);
});
