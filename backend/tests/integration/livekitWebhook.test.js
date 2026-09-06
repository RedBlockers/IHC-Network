"use strict";

const crypto = require("node:crypto");
const request = require("supertest");
const { AccessToken } = require("livekit-server-sdk");

const createApp = require("../../src/app");

async function signedWebhook(body) {
    const token = new AccessToken(process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET, { ttl: "5m" });
    token.sha256 = crypto.createHash("sha256").update(body).digest("base64");
    return token.toJwt();
}

describe("Webhook LiveKit", () => {
    const body = JSON.stringify({ event: "room_started", id: "event-1", createdAt: 1786615200, room: { name: "channel:42" } });

    it("refuse un événement dont la signature ne correspond pas au corps", async () => {
        const res = await request(createApp())
            .post("/api/v1/media/webhook")
            .set("Content-Type", "application/webhook+json")
            .set("Authorization", "invalid")
            .send(body);

        expect(res.status).toBe(401);
    });

    it("accepte un événement signé sans exposer de réponse métier", async () => {
        const res = await request(createApp())
            .post("/api/v1/media/webhook")
            .set("Content-Type", "application/webhook+json")
            .set("Authorization", await signedWebhook(body))
            .send(body);

        expect(res.status).toBe(204);
        expect(res.body).toEqual({});
    });
});
