"use strict";

jest.mock("../../src/config", () => ({ ...jest.requireActual("../../src/config"), MAX_ATTACHMENT_BYTES: 1024 }));

const { createHash } = require("node:crypto");
const fs = require("node:fs/promises");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const express = require("express");
const request = require("supertest");
const attachmentService = require("../../src/services/attachmentService");
const { uploadAttachment, uploadImage, uploadImages, MAX_BYTES } = require("../../src/middlewares/upload");
const validate = require("../../src/middlewares/validate");
const { attachmentPathSchema } = require("../../src/validators/schemas");
const { errorHandler } = require("../../src/middlewares/errorHandler");
const { BadRequest, InsufficientStorage, asyncHandler } = require("../../src/errors");

const CHANNEL = { channelId: 10, guildId: 7 };
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const deferred = () => {
    let resolve;
    const promise = new Promise((done) => {
        resolve = done;
    });
    return { promise, resolve };
};

async function eventually(check) {
    const deadline = Date.now() + 2000;
    while (Date.now() < deadline) {
        if (await check()) return;
        await delay(10);
    }
    throw new Error("Le nettoyage ou l’état attendu de l’envoi n’est pas arrivé.");
}

let temporary;
let reservations;
let servers;
let clients;
let reserve;
let consume;

async function makeReservation() {
    const directory = await fs.mkdtemp(path.join(temporary, "reservation-"));
    await fs.writeFile(path.join(directory, "reservation.json"), JSON.stringify({ bytes: 1024 }), { mode: 0o600 });
    let released;
    const reservation = {
        directory,
        controller: new AbortController(),
        phase: "receiving",
        release: jest.fn(() => {
            released ??= fs.rm(directory, { recursive: true, force: true });
            return released;
        }),
    };
    reservations.push(reservation);
    return reservation;
}

function appForUploads(onRequest) {
    const app = express();
    app.use((req, res, next) => {
        req.channel = CHANNEL;
        onRequest?.(req, res);
        next();
    });
    app.post("/attachment", uploadAttachment, validate({ body: attachmentPathSchema }), asyncHandler(consume));
    app.post("/image", uploadImage("avatar"), (req, res) => {
        res.json({ name: req.file.originalname, bytes: req.file.buffer.length, hash: digest(req.file.buffer) });
    });
    app.post("/images", uploadImages(["avatar", "banner"]), (req, res) => {
        res.json(
            Object.fromEntries(
                Object.entries(req.files).map(([field, files]) => [
                    field,
                    {
                        name: files[0].originalname,
                        bytes: files[0].buffer.length,
                        hash: digest(files[0].buffer),
                    },
                ])
            )
        );
    });
    app.use(errorHandler);
    return app;
}

async function rawUpload(app) {
    const server = http.createServer(app);
    servers.push(server);
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const client = http.request({
        host: "127.0.0.1",
        port: server.address().port,
        method: "POST",
        path: "/attachment",
        headers: { "Content-Type": "multipart/form-data; boundary=qweillo-boundary", "Content-Length": 1024 },
    });
    clients.push(client);
    client.on("error", () => {});
    client.write(
        Buffer.concat([
            Buffer.from(
                '--qweillo-boundary\r\nContent-Disposition: form-data; name="file"; filename="partial.bin"\r\nContent-Type: application/octet-stream\r\n\r\n'
            ),
            Buffer.alloc(128, 0x61),
        ])
    );
    return client;
}

async function expectReleased(reservation) {
    await eventually(() => reservation.release.mock.calls.length > 0);
    await reservation.release.mock.results[0].value;
    expect(await fs.readdir(temporary)).toEqual([]);
}

beforeEach(async () => {
    temporary = await fs.mkdtemp(path.join(os.tmpdir(), "qweillo-upload-middleware-"));
    reservations = [];
    servers = [];
    clients = [];
    reserve = jest.spyOn(attachmentService, "reserveUpload").mockImplementation(makeReservation);
    consume = jest.fn(async (req, res) => {
        if (!req.file) throw new BadRequest("Aucun fichier reçu.");
        const content = await fs.readFile(req.file.path);
        const body = {
            name: req.file.originalname,
            bytes: req.file.size,
            hash: digest(content),
            relativePath: req.body.path,
            sharedReservation: req.file.uploadReservation === req.uploadReservation,
            phase: req.uploadReservation.phase,
        };
        await req.uploadReservation.release();
        res.status(201).json(body);
    });
});

afterEach(async () => {
    for (const client of clients) client.destroy();
    await Promise.all(
        servers.map(
            (server) =>
                new Promise((resolve) => {
                    server.closeAllConnections();
                    server.close(resolve);
                })
        )
    );
    await Promise.all(reservations.map((reservation) => reservation.release()));
    reserve.mockRestore();
    await fs.rm(temporary, { recursive: true, force: true });
});

describe("Réception multipart réelle", () => {
    it("écrit un fichier binaire et son chemin dans la réservation puis libère les temporaires", async () => {
        const content = Buffer.from(Array.from({ length: 512 }, (_, index) => index % 256));
        const response = await request(appForUploads())
            .post("/attachment")
            .field("path", "atelier/plans")
            .attach("file", content, { filename: "plan.bin", contentType: "application/octet-stream" });
        expect(response.status).toBe(201);
        expect(response.body).toEqual({
            name: "plan.bin",
            bytes: content.length,
            hash: digest(content),
            relativePath: "atelier/plans",
            sharedReservation: true,
            phase: "parsed",
        });
        expect(reserve).toHaveBeenCalledWith(CHANNEL, expect.stringMatching(/^\d+$/));
        await expectReleased(reservations[0]);
    });

    it("traduit en 413 le dépassement de la limite de pièce jointe sans laisser de fichier tronqué", async () => {
        const response = await request(appForUploads())
            .post("/attachment")
            .attach("file", Buffer.alloc(1025), { filename: "large.bin", contentType: "application/octet-stream" });
        expect(response.status).toBe(413);
        expect(response.body.error).toMatchObject({ code: "payload_too_large", details: { maxBytes: 1024 } });
        expect(consume).not.toHaveBeenCalled();
        await expectReleased(reservations[0]);
    });

    it("conserve les buffers de deux images sous la limite indépendante de cinq Mio", async () => {
        const avatar = Buffer.alloc(MAX_BYTES - 1, 0x61);
        const banner = Buffer.from("image suivante");
        const response = await request(appForUploads())
            .post("/images")
            .attach("avatar", avatar, { filename: "avatar.png", contentType: "image/png" })
            .attach("banner", banner, { filename: "banner.webp", contentType: "image/webp" });
        expect(MAX_BYTES).toBe(5 * 1024 * 1024);
        expect(response.status).toBe(200);
        expect(response.body).toEqual({
            avatar: { name: "avatar.png", bytes: avatar.length, hash: digest(avatar) },
            banner: { name: "banner.webp", bytes: banner.length, hash: digest(banner) },
        });
        expect(reserve).not.toHaveBeenCalled();
    });

    it("applique les cinq Mio à chaque image d’un formulaire multiple", async () => {
        const response = await request(appForUploads())
            .post("/images")
            .attach("avatar", Buffer.alloc(16), { filename: "avatar.png", contentType: "image/png" })
            .attach("banner", Buffer.alloc(MAX_BYTES + 1), { filename: "banner.png", contentType: "image/png" });
        expect(response.status).toBe(413);
        expect(response.body.error).toMatchObject({ code: "payload_too_large", details: { maxBytes: MAX_BYTES } });
        expect(reserve).not.toHaveBeenCalled();
    });

    it("refuse le type MIME non accepté avant de remettre une image au consommateur", async () => {
        const response = await request(appForUploads())
            .post("/image")
            .attach("avatar", Buffer.from("executable"), {
                filename: "avatar.exe",
                contentType: "application/x-msdownload",
            });
        expect(response.status).toBe(415);
        expect(response.body.error.code).toBe("unsupported_media_type");
        expect(response.body.error.message).toContain("application/x-msdownload");
        expect(reserve).not.toHaveBeenCalled();
    });

    it("refuse un troisième fichier image dans un formulaire prévu pour deux", async () => {
        const response = await request(appForUploads())
            .post("/images")
            .attach("avatar", Buffer.from("first"), { filename: "first.png", contentType: "image/png" })
            .attach("banner", Buffer.from("second"), { filename: "second.png", contentType: "image/png" })
            .attach("banner", Buffer.from("third"), { filename: "third.png", contentType: "image/png" });
        expect(response.status).toBe(415);
        expect(response.body.error.code).toBe("unsupported_media_type");
    });

    it("nettoie un fichier déjà reçu lorsqu’un second champ multipart dépasse la limite", async () => {
        const response = await request(appForUploads())
            .post("/attachment")
            .attach("file", Buffer.alloc(128), { filename: "part.bin" })
            .field("path", "atelier")
            .field("extra", "interdit");
        expect(response.status).toBe(415);
        expect(response.body.error.code).toBe("unsupported_media_type");
        expect(consume).not.toHaveBeenCalled();
        await expectReleased(reservations[0]);
    });

    it("libère aussi le fichier parsé lorsque le chemin est rejeté par la validation métier", async () => {
        const response = await request(appForUploads())
            .post("/attachment")
            .attach("file", Buffer.alloc(128), { filename: "part.bin" })
            .field("path", "x".repeat(513));
        expect(response.status).toBe(400);
        expect(response.body.error.code).toBe("bad_request");
        expect(reservations[0].phase).toBe("parsed");
        expect(consume).not.toHaveBeenCalled();
        await expectReleased(reservations[0]);
    });

    it("libère une réservation pour un formulaire multipart sans fichier", async () => {
        const response = await request(appForUploads()).post("/attachment").field("path", "atelier");
        expect(response.status).toBe(400);
        expect(response.body.error.message).toBe("Aucun fichier reçu.");
        await expectReleased(reservations[0]);
    });

    it("renvoie le refus d’admission 507 avant de parser un multipart invalide", async () => {
        reserve.mockRejectedValue(new InsufficientStorage("Disque indisponible pour cet envoi."));
        const response = await request(appForUploads())
            .post("/attachment")
            .set("Content-Type", "multipart/form-data")
            .send("corps sans délimiteur multipart");
        expect(response.status).toBe(507);
        expect(response.body.error).toMatchObject({
            code: "insufficient_storage",
            message: "Disque indisponible pour cet envoi.",
        });
        expect(consume).not.toHaveBeenCalled();
        expect(await fs.readdir(temporary)).toEqual([]);
    });

    it("libère une réservation obtenue après la déconnexion du client pendant l’admission", async () => {
        const entered = deferred();
        const admitted = deferred();
        const disconnected = deferred();
        reserve.mockImplementation(async () => {
            const reservation = await makeReservation();
            entered.resolve(reservation);
            await admitted.promise;
            return reservation;
        });
        const client = await rawUpload(appForUploads((req) => req.once("close", disconnected.resolve)));
        const reservation = await entered.promise;
        client.destroy();
        await disconnected.promise;
        admitted.resolve();
        await expectReleased(reservation);
        expect(consume).not.toHaveBeenCalled();
    });

    it.each(["client", "réservation"])(
        "nettoie le fichier partiel après interruption par %s pendant le corps",
        async (origin) => {
            const client = await rawUpload(appForUploads());
            await eventually(() => reservations.length === 1);
            const reservation = reservations[0];
            await eventually(async () => {
                const files = (await fs.readdir(reservation.directory)).filter((name) => name !== "reservation.json");
                if (!files.length) return false;
                return (await fs.stat(path.join(reservation.directory, files[0]))).size > 0;
            });
            if (origin === "client") client.destroy();
            else reservation.controller.abort();
            await expectReleased(reservation);
            expect(reservation.controller.signal.aborted).toBe(true);
            expect(consume).not.toHaveBeenCalled();
        }
    );
});
