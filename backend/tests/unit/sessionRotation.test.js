"use strict";

const committed = [];

jest.mock("../../src/db/pool", () => ({
    withTransaction: async (callback) => {
        const connection = { pending: [] };
        const result = await callback(connection);
        committed.push(...connection.pending);
        return result;
    },
}));

jest.mock("../../src/repositories/sessionRepository", () => ({
    findByTokenForUpdate: jest.fn().mockResolvedValue({
        sessionId: "session-1",
        familyId: "family-1",
        userId: "1",
        expiresAt: new Date(Date.now() + 60_000),
        revokedAt: new Date(),
    }),
    revokeFamily: jest.fn(async (familyId, connection) => connection.pending.push(`family:${familyId}`)),
    revoke: jest.fn(),
    create: jest.fn(),
}));

jest.mock("../../src/repositories/userRepository", () => ({ findById: jest.fn() }));
jest.mock("../../src/services/tokenService", () => ({ sign: jest.fn() }));

const sessionService = require("../../src/services/sessionService");

describe("rotation de session", () => {
    it("valide la révocation familiale avant de rejeter un jeton réutilisé", async () => {
        await expect(sessionService.rotate("ancien-jeton")).rejects.toMatchObject({ status: 401 });
        expect(committed).toContain("family:family-1");
    });
});
