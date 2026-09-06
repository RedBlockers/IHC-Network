"use strict";

const redis = require("../../src/infra/redis");
const service = require("../../src/services/voicePresenceService");

function fakeRedis() {
    const hashes = new Map();
    return {
        hset: jest.fn(async (key, field, value) => {
            const hash = hashes.get(key) ?? new Map();
            hash.set(field, value);
            hashes.set(key, hash);
        }),
        hdel: jest.fn(async (key, field) => hashes.get(key)?.delete(field) ?? false),
        hgetall: jest.fn(async (key) => Object.fromEntries(hashes.get(key) ?? [])),
        expire: jest.fn(async () => true),
        del: jest.fn(async (key) => hashes.delete(key)),
    };
}

describe("Présence vocale LiveKit", () => {
    let client;
    beforeEach(() => {
        client = fakeRedis();
        jest.spyOn(redis, "getClient").mockReturnValue(client);
    });

    afterEach(() => jest.restoreAllMocks());

    it("conserve l'heure d'entrée fournie par le SFU et renvoie une liste stable", async () => {
        await service.join(42, {
            userId: 7,
            handle: "alice",
            displayName: "Alice",
            avatar: "/alice.webp",
            joinedAt: "2026-08-13T10:00:00.000Z",
        });

        await service.join(42, {
            userId: 9,
            handle: "bob",
            displayName: "Bob",
            avatar: null,
            joinedAt: "2026-08-13T10:01:00.000Z",
        });

        await expect(service.list(42)).resolves.toEqual([
            expect.objectContaining({ userId: 7, displayName: "Alice", joinedAt: "2026-08-13T10:00:00.000Z" }),
            expect.objectContaining({ userId: 9, displayName: "Bob", joinedAt: "2026-08-13T10:01:00.000Z" }),
        ]);
        expect(client.expire).toHaveBeenCalledWith("voice:channel:42", 86400);
    });

    it("retire un participant et purge la salle terminée", async () => {
        await service.join(42, { userId: 7, handle: "alice", displayName: "Alice", avatar: null, joinedAt: new Date().toISOString() });
        await service.leave(42, 7);
        await expect(service.list(42)).resolves.toEqual([]);
        await service.clear(42);
        expect(client.del).toHaveBeenCalledWith("voice:channel:42");
    });
});
