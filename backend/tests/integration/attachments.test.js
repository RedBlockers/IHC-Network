"use strict";

const request = require("supertest");

const createApp = require("../../src/app");
const { on } = require("../helpers/db");
const { makeUser, authenticateAs } = require("../helpers/auth");
const { allowWrite } = require("../helpers/writePath");
const attachmentService = require("../../src/services/attachmentService");
const { previewKind, humanSize } = require("../../src/domain/filePreview");

const author = makeUser({ userId: 5, handle: "auteur" });
const other = makeUser({ userId: 6, handle: "autre" });

function fileChannel(user = author) {
    on("access.resolveChannel", () => ({ channelId: 10, guildId: 7, type: "text", name: "général", position: 0 }));
    on("access.channelPermission", () => [{ ownerId: 99, baseEffect: "allow", targetType: null, overrideEffect: null }]);
    on("access.guildRole", () => ({ role: "member" }));
    allowWrite();
    on("automod.findConfig", () => null);
    return authenticateAs(author, other)(user);
}

const ROW = (overrides = {}) => ({
    attachmentId: 3, channelId: 10, messageId: null, userId: 5, name: "plan.png", mime: "image/png",
    bytes: 2048, storageKey: "attachments/10/x/plan.png", url: "/media/attachments/10/x/plan.png",
    width: null, height: null, path: "", version: 1, replacesId: null, createdAt: new Date(), ...overrides,
});

describe("Pièces jointes", () => {
    it("assainit le nom et le chemin d'un envoi de dossier", () => {
        expect(attachmentService.safeName("../../etc/passwd")).toBe("passwd");
        expect(attachmentService.safeName("")).toBe("fichier");
        expect(attachmentService.safePath("../a/./b/../c/plan.png")).toBe("a/b/c/plan.png");
        expect(attachmentService.safePath("/absolu/x")).toBe("absolu/x");
    });

    it("n'annonce un aperçu que si le type déclaré et l'extension s'accordent", () => {
        expect(previewKind("image/png", "plan.png")).toBe("image");
        expect(previewKind("video/mp4", "clip.mp4")).toBe("video");
        expect(previewKind("text/markdown", "notes.md")).toBe("text");
        expect(previewKind("image/png", "charge.exe")).toBe("file");
        expect(previewKind("application/octet-stream", "plan.png")).toBe("file");
    });

    it("rend une taille lisible", () => {
        expect(humanSize(512)).toBe("512 o");
        expect(humanSize(2048)).toBe("2,0 ko");
        expect(humanSize(2_500_000_000)).toBe("2,5 Go");
    });

    it("refuse de citer la pièce jointe de quelqu'un d'autre", async () => {
        const authorization = fileChannel(other);
        on("attachments.findByIds", () => [ROW({ userId: 5 })]);

        const response = await request(createApp())
            .post("/api/v1/channels/10/messages")
            .set("Authorization", authorization)
            .send({ content: "voici le plan", attachmentIds: [3] });

        expect(response.status).toBe(404);
        expect(response.body.error.message).toBe("Pièce jointe introuvable.");
    });

    it("refuse de réutiliser une pièce déjà attachée à un message", async () => {
        const authorization = fileChannel();
        on("attachments.findByIds", () => [ROW({ messageId: "900" })]);

        const response = await request(createApp())
            .post("/api/v1/channels/10/messages")
            .set("Authorization", authorization)
            .send({ content: "encore", attachmentIds: [3] });

        expect(response.status).toBe(400);
    });

    it("refuse une pièce venue d'un autre salon", async () => {
        const authorization = fileChannel();
        on("attachments.findByIds", () => [ROW({ channelId: 42 })]);

        const response = await request(createApp())
            .post("/api/v1/channels/10/messages")
            .set("Authorization", authorization)
            .send({ content: "ailleurs", attachmentIds: [3] });

        expect(response.status).toBe(404);
    });

    it("rattache les pièces au message dans la même opération", async () => {
        const authorization = fileChannel();
        on("attachments.findByIds", () => [ROW()]);
        let attached = null;
        on("attachments.attachToMessage", (params) => {
            attached = params;
            return { affectedRows: 1 };
        });
        on("messages.create", () => ({}));
        on("messages.findById", () => ({
            messageId: "900", channelId: 10, content: "voici le plan", createdAt: new Date(), editedAt: null,
            encryptionEpoch: null, userId: 5, handle: "auteur", displayName: "Auteur", avatar: null,
        }));

        const response = await request(createApp())
            .post("/api/v1/channels/10/messages")
            .set("Authorization", authorization)
            .send({ content: "voici le plan", attachmentIds: [3] });

        expect(response.status).toBe(201);
        expect(attached).toEqual(["900", 3]);
        expect(response.body.message.attachments[0].kind).toBe("image");
        expect(response.body.message.attachments[0].size).toBe("2,0 ko");
    });

    it("plafonne le nombre de pièces par message", async () => {
        const authorization = fileChannel();

        const response = await request(createApp())
            .post("/api/v1/channels/10/messages")
            .set("Authorization", authorization)
            .send({ content: "trop", attachmentIds: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] });

        expect(response.status).toBe(400);
    });

    it("sert l'historique des versions d'un même nom, du plus récent au plus ancien", async () => {
        const authorization = fileChannel();
        on("attachments.listVersions", (params) => {
            expect(params).toEqual([10, "plan.png"]);
            return [
                { ...ROW({ version: 2, attachmentId: 4 }), handle: "auteur", displayName: "Auteur" },
                { ...ROW({ version: 1, attachmentId: 3 }), handle: "auteur", displayName: "Auteur" },
            ];
        });

        const response = await request(createApp())
            .get("/api/v1/channels/10/attachments/versions?name=plan.png")
            .set("Authorization", authorization);

        expect(response.status).toBe(200);
        expect(response.body.versions.map((v) => v.version)).toEqual([2, 1]);
    });

    describe("Quota de la communauté", () => {
        const GB = 1024 * 1024 * 1024;
        const storageService = require("../../src/services/storageService");
        const quota = require("../../src/domain/storageQuota");

        const fs = require("node:fs");
        const os = require("node:os");
        const nodePath = require("node:path");

        const fakeFile = (bytes) => {
            const path = nodePath.join(os.tmpdir(), `qweillo-test-${Math.random().toString(16).slice(2)}`);
            fs.writeFileSync(path, "x");
            temporaries.push(path);
            return { originalname: "plan.png", mimetype: "image/png", size: bytes, path };
        };

        const temporaries = [];
        afterEach(() => {
            for (const path of temporaries.splice(0)) fs.rmSync(path, { force: true });
        });

        const guildChannel = { channelId: 10, guildId: 7 };
        const user = { userId: 5 };

        beforeEach(() => {
            on("attachments.findAbandoned", () => []);
        });

        it("refuse un envoi qui ferait dépasser le plafond, sans rien écrire", async () => {
            on("attachments.sumBytesForGuild", () => ({ used: quota.QUOTA_BYTES - 1024, files: 3, pending: 0 }));
            const put = jest.spyOn(storageService, "putStream");

            await expect(attachmentService.store(guildChannel, user, fakeFile(4096))).rejects.toMatchObject({
                status: 507,
                code: "insufficient_storage",
            });

            expect(put).not.toHaveBeenCalled();
            put.mockRestore();
        });

        it("dit combien il reste, pas seulement qu'il n'y a plus de place", async () => {
            on("attachments.sumBytesForGuild", () => ({ used: quota.QUOTA_BYTES - 500, files: 3, pending: 0 }));

            const error = await attachmentService.store(guildChannel, user, fakeFile(4096)).catch((e) => e);

            expect(error.details).toMatchObject({ remainingBytes: 500, incomingBytes: 4096 });
            expect(error.message).toMatch(/reste/);
        });

        it("efface les envois abandonnés avant de mesurer", async () => {
            const removed = [];
            jest.spyOn(storageService, "removeObject").mockImplementation(async (key) => {
                removed.push(key);
            });
            on("attachments.findAbandoned", (params) => {
                expect(params[0]).toBe(7);
                expect(params[1]).toBeInstanceOf(Date);
                return [{ attachmentId: 88, storageKey: "attachments/10/vieux/x.png", bytes: GB }];
            });
            let deleted = null;
            on("attachments.deleteByIds", (params) => {
                deleted = params;
                return { affectedRows: 1 };
            });
            on("attachments.sumBytesForGuild", () => ({ used: quota.QUOTA_BYTES, files: 1, pending: 0 }));

            await attachmentService.store(guildChannel, user, fakeFile(1024)).catch(() => {});

            expect(removed).toEqual(["attachments/10/vieux/x.png"]);
            expect(deleted).toEqual([88]);
            storageService.removeObject.mockRestore();
        });

        it("n'applique pas le quota d'une communauté à une conversation privée", async () => {
            on("attachments.sumBytesForGuild", () => {
                throw new Error("la mesure ne devrait pas être demandée");
            });
            jest.spyOn(storageService, "putStream").mockResolvedValue("/media/x");
            on("attachments.latestVersion", () => null);
            on("attachments.create", () => ({ insertId: 42 }));
            on("attachments.findById", () => ROW({ attachmentId: 42 }));

            await expect(
                attachmentService.store({ channelId: 11, guildId: null }, user, fakeFile(1024))
            ).resolves.toMatchObject({ attachmentId: 42 });

            storageService.putStream.mockRestore();
        });
    });

    it("autorise plusieurs gigaoctets, ce que seul un envoi en flux permet", () => {
        expect(attachmentService.MAX_BYTES).toBeGreaterThanOrEqual(2 * 1024 * 1024 * 1024);
    });
});
