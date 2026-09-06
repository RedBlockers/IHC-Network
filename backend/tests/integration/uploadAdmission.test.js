"use strict";

jest.mock("../../src/config", () => ({
    ...jest.requireActual("../../src/config"),
    localStorageEnabled: true,
    s3Enabled: false,
    UPLOAD_TMP_DIR: "",
}));

const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { EventEmitter } = require("node:events");
const config = require("../../src/config");
const service = require("../../src/services/attachmentService");
const storage = require("../../src/services/storageService");
const quota = require("../../src/domain/storageQuota");
const { pool } = require("../../src/db/pool");
const { on } = require("../helpers/db");
const { logger } = require("../../src/logger");

const COMMUNITY = { channelId: 10, guildId: 7 };
const DIRECT = { channelId: 11, guildId: null };
const USER = { userId: 5 };
let directory, connections, reservations, locks, waiting, usage;

function unlock(name, connection) {
    if (locks.get(name) !== connection) return { released: 0 };
    locks.delete(name);
    const next = waiting.get(name)?.shift();
    if (next) {
        locks.set(name, next.connection);
        next.resolve({ acquired: 1 });
    }
    return { released: 1 };
}

function acquire([name], _sql, connection) {
    if (!locks.has(name)) {
        locks.set(name, connection);
        return { acquired: 1 };
    }
    return new Promise((resolve) => {
        if (!waiting.has(name)) waiting.set(name, []);
        waiting.get(name).push({ connection, resolve });
    });
}

function releaseQuery([name], _sql, connection) {
    if (connection.closed) throw new Error("Connexion fermée.");
    return unlock(name, connection);
}

beforeEach(async () => {
    directory = await fs.mkdtemp(path.join(os.tmpdir(), "qweillo-admission-test-"));
    config.UPLOAD_TMP_DIR = directory;
    config.localStorageEnabled = true;
    config.s3Enabled = false;
    connections = [];
    reservations = [];
    locks = new Map();
    waiting = new Map();
    usage = new Map();
    pool.getConnection = jest.fn(async () => {
        const connection = new EventEmitter();
        connection.id = connections.length + 1;
        connection.closed = false;
        connection.release = jest.fn();
        connection.destroy = jest.fn(() => {
            connection.closed = true;
            for (const name of [...locks.keys()]) unlock(name, connection);
        });
        connections.push(connection);
        return connection;
    });
    on("uploads.lock", acquire);
    on("uploads.lease", acquire);
    on("uploads.unlock", releaseQuery);
    on("uploads.release", releaseQuery);
    on("uploads.leaseOwner", ([name]) => ({ owner: locks.get(name)?.id ?? null }));
    on("attachments.findAbandoned", () => []);
    on("attachments.sumBytesForGuild", ([guildId]) => ({ used: usage.get(guildId) ?? 0 }));
    jest.spyOn(logger, "warn").mockImplementation(() => {});
});

afterEach(async () => {
    jest.restoreAllMocks();
    on("uploads.release", releaseQuery);
    await Promise.all(
        reservations.filter((reservation) => !reservation.connection.closed).map((reservation) => reservation.release())
    );
    for (const connection of connections) {
        if (!connection.closed) connection.destroy();
    }
    delete pool.getConnection;
    await fs.rm(directory, { recursive: true, force: true });
});

async function reserve(length, channel = COMMUNITY) {
    const reservation = await service.reserveUpload(channel, length);
    reservations.push(reservation);
    return reservation;
}

async function incomingFile(reservation, body = "pièce jointe de test") {
    const filename = path.join(reservation.directory, "incoming.bin");
    await fs.writeFile(filename, body);
    return {
        path: filename,
        originalname: "example.bin",
        mimetype: "application/octet-stream",
        size: Buffer.byteLength(body),
        uploadReservation: reservation,
    };
}

async function expectMissing(filename) {
    await expect(fs.stat(filename)).rejects.toMatchObject({ code: "ENOENT" });
}

function diskSpace(bytes) {
    return jest.spyOn(fs, "statfs").mockResolvedValue({ bavail: BigInt(bytes), bsize: 1n });
}

describe("Admission des pièces jointes", () => {
    it.each(["0", "-1", "1.5", "invalide", "9007199254740992"])(
        "refuse une taille annoncée invalide (%s) avant toute réservation",
        async (length) => {
            await expect(reserve(length)).rejects.toMatchObject({ status: 400 });
            expect(pool.getConnection).not.toHaveBeenCalled();
            expect(await fs.readdir(directory)).toEqual([]);
        }
    );

    it("refuse un corps annoncé au-dessus du plafond sans prendre de connexion", async () => {
        await expect(reserve(String(config.MAX_ATTACHMENT_BYTES + 1024 * 1024 + 1))).rejects.toMatchObject({
            status: 413,
            details: { maxBytes: config.MAX_ATTACHMENT_BYTES },
        });
        expect(pool.getConnection).not.toHaveBeenCalled();
    });

    it("admet quatre transferts concurrents et refuse le cinquième sans toucher aux fichiers actifs", async () => {
        const active = await Promise.all(Array.from({ length: 4 }, () => reserve("1024", DIRECT)));
        const retained = await incomingFile(active[0]);
        await expect(reserve("1024", DIRECT)).rejects.toMatchObject({ status: 429 });
        expect(await fs.readdir(directory)).toHaveLength(4);
        expect(await fs.readFile(retained.path, "utf8")).toBe("pièce jointe de test");
        expect(connections[4].release).toHaveBeenCalledTimes(1);
        expect(new Set(active.map((reservation) => reservation.connection)).size).toBe(4);
    });

    it("réserve le quota entre connexions concurrentes sans débiter une autre communauté", async () => {
        usage.set(COMMUNITY.guildId, quota.QUOTA_BYTES - 3072);
        const results = await Promise.allSettled([reserve("2048"), reserve("2048")]);
        expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
        const refused = results.find((result) => result.status === "rejected");
        expect(refused.reason).toMatchObject({ status: 507 });
        expect(refused.reason.message).toMatch(/communauté/);
        await expect(reserve("2048", { channelId: 12, guildId: 8 })).resolves.toHaveProperty("directory");
    });

    it("réserve la copie locale et la marge, mais une seule copie temporaire pour S3", async () => {
        diskSpace(service.UPLOAD_DISK_MARGIN + 2048);
        await expect(reserve("2048", DIRECT)).rejects.toMatchObject({ status: 507 });
        expect(await fs.readdir(directory)).toEqual([]);
        config.s3Enabled = true;
        await expect(reserve("2048", DIRECT)).resolves.toHaveProperty("directory");
    });

    it("compte l’espace réservé par un transfert qui n’a pas encore écrit son fichier", async () => {
        diskSpace(service.UPLOAD_DISK_MARGIN + 3 * 1024);
        const first = await reserve("1024", DIRECT);
        await expect(reserve("1024", DIRECT)).rejects.toMatchObject({ status: 507 });
        expect(await fs.readdir(first.directory)).toEqual(["reservation.json"]);
    });

    it("réserve le plafond entier si la longueur du flux n’est pas annoncée", async () => {
        diskSpace(4 * config.MAX_ATTACHMENT_BYTES + service.UPLOAD_DISK_MARGIN);
        const reservation = await reserve(undefined, DIRECT);
        const record = JSON.parse(await fs.readFile(path.join(reservation.directory, "reservation.json"), "utf8"));
        expect(record.bytes).toBe(config.MAX_ATTACHMENT_BYTES);
        expect(record.diskBytes).toBe(2 * config.MAX_ATTACHMENT_BYTES);
    });

    it("récupère une connexion disparue en préservant les répertoires actifs et étrangers", async () => {
        const live = await reserve("1024", DIRECT);
        const crashed = await reserve("1024", DIRECT);
        const partial = await incomingFile(crashed);
        const foreign = path.join(directory, "conserver");
        await fs.mkdir(foreign);
        await fs.writeFile(path.join(directory, "unrelated.txt"), "conserver");
        crashed.connection.destroy();
        await reserve("1024", DIRECT);
        await expectMissing(partial.path);
        await expectMissing(crashed.directory);
        expect((await fs.stat(live.directory)).isDirectory()).toBe(true);
        expect((await fs.stat(foreign)).isDirectory()).toBe(true);
        expect(await fs.readFile(path.join(directory, "unrelated.txt"), "utf8")).toBe("conserver");
    });

    it("refuse une réservation active corrompue au lieu de sous-estimer l’espace réservé", async () => {
        const live = await reserve("1024", DIRECT);
        await fs.writeFile(
            path.join(live.directory, "reservation.json"),
            JSON.stringify({ bytes: -1, diskBytes: 1024 })
        );
        await expect(reserve("1024", DIRECT)).rejects.toMatchObject({ status: 503 });
        expect((await fs.stat(live.directory)).isDirectory()).toBe(true);
    });

    it("rend la connexion quand le verrou d’admission n’est pas disponible", async () => {
        on("uploads.lock", () => ({ acquired: 0 }));
        await expect(reserve("1024", DIRECT)).rejects.toMatchObject({ status: 429 });
        expect(connections[0].release).toHaveBeenCalledTimes(1);
        expect(await fs.readdir(directory)).toEqual([]);
    });

    it("libère une seule fois les temporaires et le verrou malgré deux demandes de nettoyage", async () => {
        const reservation = await reserve("1024", DIRECT);
        const partial = await incomingFile(reservation);
        const first = reservation.release();
        const second = reservation.release();
        expect(second).toBe(first);
        await Promise.all([first, second]);
        await expectMissing(partial.path);
        expect(reservation.connection.release).toHaveBeenCalledTimes(1);
        expect(locks.size).toBe(0);
    });

    it("détruit la connexion si la libération du verrou échoue après le nettoyage", async () => {
        const reservation = await reserve("1024", DIRECT);
        await incomingFile(reservation);
        on("uploads.release", () => {
            throw new Error("Connexion perdue.");
        });
        await reservation.release();
        await expectMissing(reservation.directory);
        expect(reservation.connection.destroy).toHaveBeenCalledTimes(1);
        expect(reservation.connection.release).not.toHaveBeenCalled();
        expect(locks.size).toBe(0);
    });
});

describe("Fin d’un envoi admis", () => {
    it("efface le fichier reçu et sa réservation si le quota est refusé avant stockage", async () => {
        const reservation = await reserve("1024");
        const file = await incomingFile(reservation);
        usage.set(COMMUNITY.guildId, quota.QUOTA_BYTES);
        const put = jest.spyOn(storage, "putStream");
        await expect(service.store(COMMUNITY, USER, file)).rejects.toMatchObject({ status: 507 });
        expect(put).not.toHaveBeenCalled();
        await expectMissing(file.path);
        await expectMissing(reservation.directory);
        expect(reservation.connection.release).toHaveBeenCalledTimes(1);
    });

    it("interrompt le stockage si la réservation a perdu sa connexion", async () => {
        const reservation = await reserve("1024");
        const file = await incomingFile(reservation);
        const put = jest.spyOn(storage, "putStream");
        reservation.connection.emit("error", new Error("Connexion interrompue."));
        expect(reservation.controller.signal.aborted).toBe(true);
        await expect(service.store(COMMUNITY, USER, file)).rejects.toMatchObject({ status: 503 });
        expect(put).not.toHaveBeenCalled();
        await expectMissing(reservation.directory);
    });

    it.each(["ENOSPC", "EDQUOT"])("traduit %s pendant le stockage en 507 et supprime les temporaires", async (code) => {
        const reservation = await reserve("1024");
        const file = await incomingFile(reservation);
        jest.spyOn(storage, "putStream").mockImplementation(async (_key, stream) => {
            stream.destroy();
            throw Object.assign(new Error("Stockage indisponible."), { code });
        });
        await expect(service.store(COMMUNITY, USER, file)).rejects.toMatchObject({ status: 507 });
        await expectMissing(file.path);
        await expectMissing(reservation.directory);
        expect(locks.size).toBe(0);
    });

    it("retire l’objet et ses métadonnées si la lecture finale échoue après insertion", async () => {
        const reservation = await reserve("1024");
        const file = await incomingFile(reservation);
        const storedFile = path.join(directory, "stored.bin");
        const rows = new Set();
        jest.spyOn(storage, "putStream").mockImplementation(async (key, stream) => {
            const chunks = [];
            for await (const chunk of stream) chunks.push(chunk);
            await fs.writeFile(storedFile, Buffer.concat(chunks));
            return `/media/${key}`;
        });
        jest.spyOn(storage, "removeObject").mockImplementation(async () => fs.rm(storedFile));
        on("attachments.latestVersion", () => null);
        on("attachments.create", () => {
            rows.add(42);
            return { insertId: 42 };
        });
        const failure = new Error("Lecture finale impossible.");
        on("attachments.findById", () => {
            throw failure;
        });
        on("attachments.deleteByIds", (ids) => {
            for (const id of ids) rows.delete(id);
            return { affectedRows: ids.length };
        });
        await expect(service.store(COMMUNITY, USER, file)).rejects.toBe(failure);
        expect(rows.size).toBe(0);
        await expectMissing(storedFile);
        await expectMissing(file.path);
        await expectMissing(reservation.directory);
        expect(locks.size).toBe(0);
    });
});
