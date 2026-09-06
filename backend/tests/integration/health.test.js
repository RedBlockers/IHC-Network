"use strict";

const request = require("supertest");

const createApp = require("../../src/app");

describe("Sondes de santé", () => {
    it("/readyz décrit TURN sans secret", async () => {
        const response = await request(createApp()).get("/readyz");

        expect(response.status).toBe(200);
        expect(response.body.checks.turn).toEqual({ configured: false });
        expect(JSON.stringify(response.body)).not.toMatch(/secret|password|credential|LIVEKIT_TURN_SECRET/i);
    });

    it("/healthz ne touche aucune dépendance", async () => {
        const response = await request(createApp()).get("/healthz");
        expect(response.status).toBe(200);
        expect(response.body).toEqual({ status: "ok" });
    });
});
