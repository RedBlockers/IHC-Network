import assert from "node:assert/strict";
import test from "node:test";

import { groupChannelsByCategory } from "../src/lib/channels.js";

test("les catégories suivent leur ordre et conservent les salons non classés", () => {
    const categories = [
        { categoryId: 2, name: "VOCAL", position: 3 },
        { categoryId: 1, name: "ROYAUME", position: 1 },
    ];
    const channels = [
        { channelId: 13, name: "place", type: "voice", categoryId: 2, position: 2 },
        { channelId: 11, name: "annonces", type: "text", categoryId: 1, position: 1 },
        { channelId: 12, name: "général", type: "text", categoryId: null, position: 0 },
    ];

    assert.deepEqual(groupChannelsByCategory(categories, channels), [
        { categoryId: 1, name: "ROYAUME", position: 1, channels: [channels[1]] },
        { categoryId: 2, name: "VOCAL", position: 3, channels: [channels[0]] },
        { categoryId: null, name: "AUTRES SALONS", position: Number.MAX_SAFE_INTEGER, channels: [channels[2]] },
    ]);
});
