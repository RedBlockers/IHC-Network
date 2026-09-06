"use strict";

const request = require("supertest");

const createApp = require("../../src/app");
const { on } = require("../helpers/db");
const { makeUser, authenticateAs } = require("../helpers/auth");

describe("Jeton média : modes vocaux et E2EE applicatif", () => {
    const alice = makeUser({ userId: 1, handle: "alice", displayName: "Alice" });
    const app = createApp();
    let token;

    const allow = (type, { e2eeEnabled = 0, channelId = 20 } = {}) => {
        on("access.resolveChannel", () => [{
            channelId,
            type,
            name: type,
            guildId: 7,
            friendshipId: null,
            position: 0,
            e2eeEnabled,
        }]);
        on("access.channelPermission", () => [{
            ownerId: alice.userId,
            baseEffect: "allow",
            targetType: null,
            overrideEffect: null,
        }]);
    };

    beforeEach(() => {
        token = authenticateAs(alice);
    });

    const ask = (channelId = 20) =>
        request(app).post(`/api/v1/channels/${channelId}/media-token`).set("Authorization", token(alice));

    it.each(["voice", "video", "stage"])("délivre un jeton pour un salon %s", async (type) => {
        allow(type);

        const response = await ask().expect(200);

        expect(response.body.e2eeRequired).toBe(false);
        expect(response.body.token).toEqual(expect.any(String));
        expect(response.body).not.toHaveProperty("epochKey");
        expect(response.body).not.toHaveProperty("wrappedKey");
    });

    it("refuse le média dans un salon texte", async () => {
        allow("text");

        const response = await ask().expect(400);
        expect(response.body.error.code).toBe("bad_request");
    });

    it("porte e2eeRequired sans jamais rendre la clé d'époque", async () => {
        allow("video", { e2eeEnabled: 1 });

        const response = await ask().expect(200);

        expect(response.body.e2eeRequired).toBe(true);
        expect(response.body).not.toHaveProperty("epochKey");
        expect(response.body).not.toHaveProperty("wrappedKey");
        expect(response.body).not.toHaveProperty("mediaKey");
        const { token, ...publicBody } = response.body;
        expect(token).toEqual(expect.any(String));
        expect(JSON.stringify(publicBody)).not.toMatch(/secret|password|credential/i);

        const [, payload] = response.body.token.split(".");
        const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
        expect(claims).not.toHaveProperty("epochKey");
        expect(claims).not.toHaveProperty("e2eeKey");
        expect(JSON.stringify(claims)).not.toMatch(/wrappedKey|epochKey|mediaKey/);
    });
});
