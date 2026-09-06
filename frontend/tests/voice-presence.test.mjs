import assert from "node:assert/strict";
import test from "node:test";

import { formatVoiceDuration } from "../src/lib/voice.js";

test("la durée vocale reste compacte et déterministe", () => {
    const joinedAt = "2026-08-13T10:00:00.000Z";
    assert.equal(formatVoiceDuration(joinedAt, new Date("2026-08-13T10:04:09.000Z")), "04:09");
    assert.equal(formatVoiceDuration(joinedAt, new Date("2026-08-13T11:02:03.000Z")), "1:02:03");
});
