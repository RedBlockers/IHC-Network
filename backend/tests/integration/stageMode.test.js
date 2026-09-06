"use strict";

const request = require("supertest");
const createApp = require("../../src/app");
const { on } = require("../helpers/db");
const { makeUser, authenticateAs } = require("../helpers/auth");

describe("Droit de publier dans un salon vocal", () => {
    const alice = makeUser({ userId: 1, handle: "alice" });
    const app = createApp();
    let token;

    const permissions = (...granted) =>
        on("access.channelPermission", (params) => [
            {
                ownerId: 99,
                baseEffect: params[1] === "VIEW_CHANNEL" || granted.includes(params[1]) ? "allow" : "deny",
                targetType: null,
                overrideEffect: null,
            },
        ]);

    beforeEach(() => {
        token = authenticateAs(alice);
        on("access.resolveChannel", () => [{ channelId: 20, type: "voice", guildId: 7, friendshipId: null }]);
        on("channels.findById", () => [{ channelId: 20, type: "voice", guildId: 7, name: "scene" }]);
    });

    const ask = () =>
        request(app).post("/api/v1/channels/20/media-token").set("Authorization", token(alice));

    test("un intervenant reçoit le droit de publier sa voix", async () => {
        permissions("CONNECT", "SPEAK");

        const response = await ask().expect(200);

        expect(response.body.publish).toEqual({ microphone: true, camera: false, screen: false });
    });

    test("le public rejoint sans aucune source autorisée", async () => {
        permissions("CONNECT");

        const response = await ask().expect(200);

        expect(response.body.publish).toEqual({ microphone: false, camera: false, screen: false });
        expect(response.body.token).toEqual(expect.any(String));
    });

    test("la caméra et le partage d'écran sont accordés séparément de la voix", async () => {
        permissions("CONNECT", "SPEAK", "STREAM");

        const response = await ask().expect(200);

        expect(response.body.publish.microphone).toBe(true);
        expect(response.body.publish.camera).toBe(false);
        expect(response.body.publish.screen).toBe(true);
    });

    test("sans CONNECT, aucun jeton n'est délivré", async () => {
        permissions("SPEAK");

        await ask().expect(403);
    });

    test("le refus de publier est porté par le jeton, pas seulement par la réponse", async () => {
        permissions("CONNECT");

        const response = await ask().expect(200);

        const [, payload] = response.body.token.split(".");
        const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));

        expect(claims.video.canPublish).toBe(false);
        expect(claims.video.canSubscribe).toBe(true);
        expect(claims.video.canPublishData).toBe(true);
    });

    test("l'intervenant voit ses sources listées dans le jeton", async () => {
        permissions("CONNECT", "SPEAK");

        const response = await ask().expect(200);
        const [, payload] = response.body.token.split(".");
        const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));

        expect(claims.video.canPublish).toBe(true);
        expect(claims.video.canPublishSources).toEqual(["microphone"]);
    });
});
