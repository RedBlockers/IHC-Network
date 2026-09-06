"use strict";

const fs = require("node:fs");
const request = require("supertest");

const config = require("../../src/config");
const maintenance = require("../../src/infra/maintenance");
const createApp = require("../../src/app");

const file = config.MAINTENANCE_FILE;

const enable = (reason) => {
    fs.writeFileSync(file, reason ?? "");
    maintenance.forget();
};

const disable = () => {
    fs.rmSync(file, { force: true });
    maintenance.forget();
};

describe("Mode maintenance", () => {
    afterEach(disable);

    it("laisse tout passer tant que le fichier n'existe pas", async () => {
        const response = await request(createApp()).get("/api/v1/status");
        expect(response.status).toBe(200);
        expect(response.body.maintenance).toEqual({ active: false, reason: null });
    });

    it("refuse les appels avec le motif écrit dans le fichier", async () => {
        enable("Migration de la base, retour vers 22 h.");

        const response = await request(createApp()).get("/api/v1/guilds");

        expect(response.status).toBe(503);
        expect(response.body.error.code).toBe("maintenance");
        expect(response.body.error.message).toBe("Migration de la base, retour vers 22 h.");
        expect(response.headers["retry-after"]).toBe("120");
    });

    it("reste une maintenance même sans motif écrit", async () => {
        enable("");

        const response = await request(createApp()).get("/api/v1/guilds");

        expect(response.status).toBe(503);
        expect(response.body.error.message).toMatch(/maintenance/i);
    });

    it("laisse répondre les sondes de santé", async () => {
        enable("Interruption annoncée.");

        const response = await request(createApp()).get("/healthz");
        expect(response.status).toBe(200);
    });

    it("laisse consulter l'état, et lui seul, pour que l'interface s'explique", async () => {
        enable("Migration de la base.");
        const app = createApp();

        const status = await request(app).get("/api/v1/status");
        expect(status.status).toBe(200);
        expect(status.body.maintenance).toEqual({ active: true, reason: "Migration de la base." });

        const login = await request(app).post("/api/v1/auth/login").send({ handle: "ada", password: "x" });
        expect(login.status).toBe(503);
    });

    it("laisse toujours se déconnecter", async () => {
        enable("Interruption annoncée.");

        const response = await request(createApp()).post("/api/v1/auth/logout");
        expect(response.status).not.toBe(503);
    });

    it("se retire aussi vite qu'elle s'est posée", async () => {
        enable("Interruption annoncée.");
        expect((await request(createApp()).get("/api/v1/guilds")).status).toBe(503);

        disable();

        const response = await request(createApp()).get("/api/v1/status");
        expect(response.body.maintenance.active).toBe(false);
    });
});
