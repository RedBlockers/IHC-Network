import assert from "node:assert/strict";
import test from "node:test";

import {
    AUDIO_PROCESSING,
    appliedAudioProcessing,
    audioConstraints,
    cameraCaptureFor,
    cameraEncodingFor,
} from "../src/lib/mediaQuality.js";

test("les trois traitements sont demandés par défaut", () => {
    const constraints = audioConstraints(AUDIO_PROCESSING);
    assert.equal(constraints.noiseSuppression, true);
    assert.equal(constraints.echoCancellation, true);
    assert.equal(constraints.autoGainControl, true);
});

test("couper la suppression de bruit coupe aussi l'isolation de voix", () => {
    const constraints = audioConstraints({ ...AUDIO_PROCESSING, noiseSuppression: false });
    assert.equal(constraints.noiseSuppression, false);
    assert.equal(constraints.voiceIsolation, false);
});

test("chaque traitement se coupe indépendamment", () => {
    const constraints = audioConstraints({ noiseSuppression: true, echoCancellation: false, autoGainControl: true });
    assert.equal(constraints.echoCancellation, false);
    assert.equal(constraints.noiseSuppression, true);
    assert.equal(constraints.autoGainControl, true);
});

test("l'état appliqué est relu sur la piste, pas déduit de la demande", () => {
    const track = {
        getSettings: () => ({ noiseSuppression: false, echoCancellation: true, autoGainControl: true }),
    };

    assert.deepEqual(appliedAudioProcessing(track), {
        noiseSuppression: false,
        echoCancellation: true,
        autoGainControl: true,
    });
});

test("un traitement dont le navigateur ne dit rien vaut null, pas false", () => {
    const track = { getSettings: () => ({ echoCancellation: true }) };
    const applied = appliedAudioProcessing(track);

    assert.equal(applied.noiseSuppression, null);
    assert.equal(applied.echoCancellation, true);
});

test("sans piste, il n'y a rien à rapporter", () => {
    assert.equal(appliedAudioProcessing(null), null);
    assert.equal(appliedAudioProcessing({}), null);
});

test("l'économie de données réduit la capture et le débit", () => {
    const normal = cameraEncodingFor({ dataSaver: false });
    const saver = cameraEncodingFor({ dataSaver: true });

    assert.ok(saver.maxBitrate < normal.maxBitrate);
    assert.ok(cameraCaptureFor({ dataSaver: true }).width < cameraCaptureFor({ dataSaver: false }).width);
});

test("l'économie de données ne coupe jamais la vidéo", () => {
    const capture = cameraCaptureFor({ dataSaver: true });

    assert.ok(capture.width > 0 && capture.height > 0 && capture.frameRate > 0);
});
