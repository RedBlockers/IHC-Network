import assert from "node:assert/strict";
import test from "node:test";
import { connectionReport } from "../src/lib/mediaQuality.js";

test("le rapport lit les valeurs RTCStatsReport et le trajet réellement choisi", async () => {
    const stats = new Map([
        ["other", { id: "other", type: "candidate-pair", state: "succeeded", currentRoundTripTime: 5 }],
        [
            "selected",
            {
                id: "selected",
                type: "candidate-pair",
                state: "succeeded",
                currentRoundTripTime: 0.023,
                availableOutgoingBitrate: 1_000_000,
            },
        ],
        ["transport", { type: "transport", selectedCandidatePairId: "selected" }],
        [
            "out",
            {
                type: "outbound-rtp",
                kind: "video",
                frameWidth: 1280,
                frameHeight: 720,
                framesPerSecond: 30,
                qualityLimitationReason: "none",
            },
        ],
        ["in", { type: "remote-inbound-rtp", kind: "video", fractionLost: 0.012 }],
    ]);
    const room = { engine: { pcManager: { publisher: { _pc: { getStats: async () => stats } } } } };
    assert.deepEqual(await connectionReport(room), {
        sending: 1_000_000,
        resolution: "1280×720",
        framerate: 30,
        limitedBy: "none",
        roundTrip: 23,
        lost: 1,
    });
});

test("sans connexion RTC le rapport reste indisponible", async () => {
    assert.equal(await connectionReport(null), null);
});
