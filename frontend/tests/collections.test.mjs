import test from "node:test";
import assert from "node:assert/strict";

import { appendUniqueBy } from "../src/lib/collections.js";

test("un événement temps réel ne duplique pas une entité déjà appliquée par HTTP", () => {
    const current = [{ channelId: 10, name: "général" }];
    const repeated = appendUniqueBy(current, { channelId: 10, name: "général" }, "channelId");
    assert.strictEqual(repeated, current);
    assert.deepEqual(appendUniqueBy(current, { channelId: 11, name: "agora" }, "channelId"), [
        ...current,
        { channelId: 11, name: "agora" },
    ]);
});
