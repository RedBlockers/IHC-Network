"use strict";

const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { PassThrough, Readable } = require("node:stream");
const { setTimeout: delay } = require("node:timers/promises");
const request = require("supertest");
const sharp = require("sharp");

const baseConfig = jest.requireActual("../../src/config");
const mockConfig = { ...baseConfig };
const mockS3Send = jest.fn();

jest.mock("../../src/config", () => mockConfig);
jest.mock("@aws-sdk/client-s3", () => ({
    ...jest.requireActual("@aws-sdk/client-s3"),
    S3Client: jest.fn(() => ({ send: mockS3Send })),
}));

const createApp = require("../../src/app");
const { PutObjectCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3");

function loadStorage(overrides) {
    Object.assign(mockConfig, baseConfig, {
        localStorageEnabled: false,
        s3Enabled: false,
        storageEnabled: true,
        STORAGE_PUBLIC_URL: "/media",
        ...overrides,
    });
    let storage;
    jest.isolateModules(() => {
        storage = jest.requireActual("../../src/services/storageService");
    });
    return storage;
}

const PNG = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    "base64"
);
const KEY = "attachments/example/upload.bin";
const ACTIVE_SVG = Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><script>alert(1)</script><rect width="64" height="64"/></svg>'
);
const ASSETS = [
    ["avatar", (storage, bytes) => storage.saveAvatar(7, bytes), 256, 256],
    ["icône de communauté", (storage, bytes) => storage.saveGuildIcon(bytes), 512, 512],
    ["bannière de communauté", (storage, bytes) => storage.saveGuildBanner(bytes), 1600, 560],
    ["bannière de profil", (storage, bytes) => storage.saveUserBanner(7, bytes), 1200, 400],
];

async function partialFile(directory) {
    const deadline = Date.now() + 2000;
    while (Date.now() < deadline) {
        const names = await fs.readdir(directory);
        for (const name of names) {
            if ((await fs.stat(path.join(directory, name))).size > 0) return name;
        }
        await delay(10);
    }
    throw new Error("Le flux n’a pas écrit son premier morceau sur disque.");
}

describe("Stockage réel des pièces jointes et frontière HTTP", () => {
    let directory;
    let storage;
    beforeEach(async () => {
        directory = await fs.mkdtemp(path.join(os.tmpdir(), "qweillo-attachment-test-"));
        storage = loadStorage({ localStorageEnabled: true, LOCAL_STORAGE_DIR: directory });
    });
    afterEach(async () => {
        await fs.rm(directory, { recursive: true, force: true });
    });

    it.each([
        ["page.html", "text/html", '<script src="/media/script.js"></script>'],
        ["script.js", "application/javascript", "window.attachmentExecuted = true"],
        ["image.svg", "image/svg+xml", '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>'],
        ["sans-extension", "text/html", "<script>alert(1)</script>"],
    ])("sert %s comme téléchargement inerte, même depuis la même origine", async (name, mime, content) => {
        const bytes = Buffer.from(content);
        const url = await storage.putStream(`attachments/${name}`, Readable.from([bytes]), mime, bytes.length);

        const response = await request(createApp()).get(url).expect(200);

        expect(response.body).toEqual(bytes);
        expect(response.headers["content-disposition"]).toBe("attachment");
        expect(response.headers["content-type"]).toBe("application/octet-stream");
        expect(response.headers["x-content-type-options"]).toBe("nosniff");
        const policy = response.headers["content-security-policy"];
        expect(policy).toMatch(/(?:^|;)\s*sandbox(?:;|$)/);
        expect(policy).toContain("default-src 'none'");
        expect(policy).toContain("frame-ancestors 'none'");
    });

    it.each([
        ["photo.png", "image/png", PNG],
        ["son.mp3", "audio/mpeg", Buffer.from("ID3-audio-fixture")],
        ["video.mp4", "video/mp4", Buffer.from("isom-video-fixture")],
        ["document.pdf", "application/pdf", Buffer.from("%PDF-1.4\n%%EOF")],
    ])("conserve le type, le flux et les requêtes partielles de %s", async (name, mime, bytes) => {
        const url = await storage.putStream(`attachments/${name}`, Readable.from([bytes]), mime, bytes.length);
        const app = createApp();

        const response = await request(app).get(url).expect(200);
        expect(response.headers["content-disposition"]).toBe("inline");
        expect(response.headers["content-type"]).toBe(mime);
        expect(await fs.readFile(path.join(directory, "attachments", name))).toEqual(bytes);
        const partial = await request(app).get(url).set("Range", "bytes=0-3").expect(206);
        expect(partial.headers["content-range"]).toBe(`bytes 0-3/${bytes.length}`);
        expect(Number(partial.headers["content-length"])).toBe(4);
        expect(await fs.readdir(path.join(directory, "attachments"))).toEqual([name]);

        await storage.removeObject(`attachments/${name}`);
        await request(app).get(url).expect(404);
        await storage.removeObject(`attachments/${name}`);
    });

    it.each(["erreur", "annulation"])("efface un envoi partiellement écrit après %s", async (kind) => {
        const parent = path.join(directory, path.dirname(KEY));
        await fs.mkdir(parent, { recursive: true });
        const source = new PassThrough();
        const controller = new AbortController();
        const failure = new Error("lecture interrompue");
        const result = storage.putStream(KEY, source, "application/octet-stream", 1024, controller.signal).then(
            () => ({ succeeded: true }),
            (error) => ({ error })
        );
        try {
            source.write(Buffer.from("premier morceau"));
            const temporary = await partialFile(parent);
            const app = createApp();
            await request(app)
                .get(`/media/${path.posix.dirname(KEY)}/${temporary}`)
                .expect(404);
            await request(app).get(`/media/${KEY}`).expect(404);

            if (kind === "annulation") controller.abort();
            else source.destroy(failure);
            const outcome = await result;

            if (kind === "annulation") expect(outcome.error?.name).toBe("AbortError");
            else expect(outcome.error).toBe(failure);
            expect(source.destroyed).toBe(true);
            expect(await fs.readdir(parent)).toEqual([]);
            await request(app).get(`/media/${KEY}`).expect(404);
        } finally {
            controller.abort();
            await result;
        }
    });

    it("ne laisse rien quand la requête est déjà annulée", async () => {
        const controller = new AbortController();
        controller.abort();
        const source = Readable.from([Buffer.from("contenu")]);

        await expect(storage.putStream(KEY, source, "text/plain", 7, controller.signal)).rejects.toMatchObject({
            name: "AbortError",
        });

        expect(source.destroyed).toBe(true);
        expect(await fs.readdir(path.join(directory, path.dirname(KEY)))).toEqual([]);
    });

    it("ferme aussi le flux si le répertoire de destination est inaccessible", async () => {
        await fs.writeFile(path.join(directory, "attachments"), "un fichier occupe le chemin");
        const source = new PassThrough();

        await expect(storage.putStream(KEY, source, "text/plain", 7)).rejects.toMatchObject({ code: "ENOTDIR" });

        expect(source.destroyed).toBe(true);
        expect(await fs.readdir(directory)).toEqual(["attachments"]);
    });

    it.each(ASSETS)("normalise réellement le PNG de %s avant sa publication", async (_name, save, width, height) => {
        const url = await save(storage, PNG);

        expect(url).toMatch(/^\/media\/.+\.webp$/);
        const bytes = await fs.readFile(path.join(directory, url.slice("/media/".length)));
        expect(await sharp(bytes).metadata()).toMatchObject({ format: "webp", width, height });
        await request(createApp()).get(url).expect(200).expect("Content-Type", "image/webp");
        const entries = await fs.readdir(directory, { recursive: true, withFileTypes: true });
        expect(entries.filter((entry) => entry.isFile())).toHaveLength(1);
    });

    it.each(ASSETS)("refuse le contenu SVG actif présenté comme %s", async (_name, save) => {
        await expect(save(storage, ACTIVE_SVG)).rejects.toMatchObject({
            status: 415,
            code: "unsupported_media_type",
        });

        expect(await fs.readdir(directory)).toEqual([]);
    });

    it.each(ASSETS)("ne publie aucune URL pour un buffer illisible de %s", async (_name, save) => {
        await expect(save(storage, Buffer.from("contenu qui n’est pas une image"))).rejects.toMatchObject({
            status: 503,
            code: "service_unavailable",
        });

        expect(await fs.readdir(directory)).toEqual([]);
    });

    it.each(ASSETS)("ne publie pas de %s si aucun stockage n’est configuré", async (_name, save) => {
        const unavailable = loadStorage({ storageEnabled: false });

        await expect(save(unavailable, PNG)).rejects.toMatchObject({ status: 503, code: "service_unavailable" });

        expect(await fs.readdir(directory)).toEqual([]);
    });
});

describe("Pièces jointes sur un stockage S3", () => {
    let storage;
    beforeEach(() => {
        mockS3Send.mockReset();
        storage = loadStorage({
            s3Enabled: true,
            S3_BUCKET: "attachments-test",
            S3_PUBLIC_URL: "https://storage.example.test/",
        });
    });

    it.each([
        ["image.png", "image/png", "inline", "image/png"],
        ["document.pdf", "application/pdf", "inline", "application/pdf"],
        ["page.html", "text/html", "attachment", "application/octet-stream"],
        ["image.svg", "image/svg+xml", "attachment", "application/octet-stream"],
        ["script.js", "image/png", "attachment", "application/octet-stream"],
    ])("transmet une disposition sûre pour %s et le flux intact", async (name, mime, disposition, type) => {
        const bytes = Buffer.from("pièce jointe");
        let received;
        mockS3Send.mockImplementation(async (command) => {
            const chunks = [];
            for await (const chunk of command.input.Body) chunks.push(Buffer.from(chunk));
            received = Buffer.concat(chunks);
        });

        const url = await storage.putStream(`attachments/${name}`, Readable.from([bytes]), mime, bytes.length);

        const [command] = mockS3Send.mock.calls[0];
        expect(command).toBeInstanceOf(PutObjectCommand);
        expect(command.input).toMatchObject({
            Bucket: "attachments-test",
            Key: `attachments/${name}`,
            ContentLength: bytes.length,
            ContentType: type,
            ContentDisposition: disposition,
        });
        expect(received).toEqual(bytes);
        expect(url).toBe(`https://storage.example.test/attachments/${name}`);
    });

    it("transmet l’annulation à S3 et propage son échec sans publier d’URL", async () => {
        const controller = new AbortController();
        const source = Readable.from(["partiel"]);
        const failure = Object.assign(new Error("envoi annulé"), { name: "AbortError" });
        mockS3Send.mockImplementation(async (_command, options) => {
            expect(options.abortSignal).toBe(controller.signal);
            controller.abort();
            source.destroy();
            throw failure;
        });

        await expect(storage.putStream(KEY, source, "text/plain", 7, controller.signal)).rejects.toBe(failure);
        expect(controller.signal.aborted).toBe(true);
    });

    it("permet au service appelant de retirer un objet après échec de sa transaction", async () => {
        mockS3Send.mockResolvedValue({});

        await storage.removeObject(KEY);

        expect(mockS3Send).toHaveBeenCalledTimes(1);
        expect(mockS3Send.mock.calls[0][0]).toBeInstanceOf(DeleteObjectCommand);
        expect(mockS3Send.mock.calls[0][0].input).toEqual({ Bucket: "attachments-test", Key: KEY });
    });

    it.each(ASSETS)("envoie à S3 le WebP normalisé de %s", async (_name, save, width, height) => {
        mockS3Send.mockResolvedValue({});

        const url = await save(storage, PNG);

        expect(mockS3Send).toHaveBeenCalledTimes(1);
        const command = mockS3Send.mock.calls[0][0];
        expect(command).toBeInstanceOf(PutObjectCommand);
        expect(command.input).toMatchObject({ Bucket: "attachments-test", ContentType: "image/webp" });
        expect(await sharp(command.input.Body).metadata()).toMatchObject({ format: "webp", width, height });
        expect(url).toBe(`https://storage.example.test/${command.input.Key}`);
    });

    it("ne rend pas l’URL de la bannière si S3 refuse son écriture", async () => {
        mockS3Send.mockRejectedValue(new Error("réponse interne du fournisseur"));

        await expect(storage.saveGuildBanner(PNG)).rejects.toMatchObject({
            status: 503,
            code: "service_unavailable",
            message: "La bannière n'a pas pu être enregistrée.",
        });
        expect(mockS3Send).toHaveBeenCalledTimes(1);
    });
});
