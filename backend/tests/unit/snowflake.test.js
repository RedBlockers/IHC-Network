"use strict";

const { SnowflakeGenerator, timestampOf, EPOCH } = require("../../src/infra/snowflake");

describe("Snowflake", () => {
    it("génère des identifiants strictement croissants", () => {
        const gen = new SnowflakeGenerator(1);
        const ids = Array.from({ length: 10_000 }, () => BigInt(gen.next()));
        for (let i = 1; i < ids.length; i += 1) {
            expect(ids[i] > ids[i - 1]).toBe(true);
        }
    });

    it("ne produit aucune collision, même en rafale intra-milliseconde", () => {
        const gen = new SnowflakeGenerator(7);
        const ids = new Set(Array.from({ length: 50_000 }, () => gen.next()));
        expect(ids.size).toBe(50_000);
    });

    it("encode un instant décodable, proche de maintenant", () => {
        const gen = new SnowflakeGenerator(0);
        const before = Date.now();
        const id = gen.next();
        const decoded = timestampOf(id);
        expect(decoded).toBeGreaterThanOrEqual(Number(EPOCH));
        expect(Math.abs(decoded - before)).toBeLessThan(1000);
    });

    it("isole les nœuds : deux générateurs distincts ne collisionnent pas au même instant", () => {
        const a = new SnowflakeGenerator(1);
        const b = new SnowflakeGenerator(2);
        const idsA = new Set(Array.from({ length: 1000 }, () => a.next()));
        const idsB = new Set(Array.from({ length: 1000 }, () => b.next()));
        for (const id of idsB) expect(idsA.has(id)).toBe(false);
    });

    it("rejette un identifiant de nœud hors plage", () => {
        expect(() => new SnowflakeGenerator(1024)).toThrow(RangeError);
        expect(() => new SnowflakeGenerator(-1)).toThrow(RangeError);
    });

    it("reste une chaîne (les IDs dépassent Number.MAX_SAFE_INTEGER)", () => {
        const gen = new SnowflakeGenerator(1023);
        const id = gen.next();
        expect(typeof id).toBe("string");
        expect(BigInt(id) > BigInt(Number.MAX_SAFE_INTEGER)).toBe(true);
    });
});
