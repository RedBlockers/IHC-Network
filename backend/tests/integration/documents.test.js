"use strict";

const request = require("supertest");

const createApp = require("../../src/app");
const { on } = require("../helpers/db");
const { makeUser, authenticateAs } = require("../helpers/auth");
const { allowWrite } = require("../helpers/writePath");

const user = makeUser({ userId: 5, handle: "redacteur" });

function docChannel(type = "wiki") {
    on("access.resolveChannel", () => ({ channelId: 10, guildId: 7, type, name: "guide", position: 0 }));
    on("access.channelPermission", () => [
        { ownerId: 99, baseEffect: "allow", targetType: null, overrideEffect: null },
    ]);
    on("access.guildRole", () => ({ role: "member" }));
    allowWrite();
    return authenticateAs(user)(user);
}

const DOC = (overrides = {}) => ({
    documentId: 4,
    channelId: 10,
    guildId: 7,
    title: "Poser une charpente",
    position: 1,
    createdBy: 5,
    updatedBy: 5,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
});

const REVISION = (overrides = {}) => ({
    revisionId: 9,
    body: "Commencer par l'entrait.",
    summary: "Création",
    editedAt: new Date(),
    editedBy: 5,
    handle: "redacteur",
    displayName: "Rédacteur",
    ...overrides,
});

describe("Modes documentaires", () => {
    it("préserve la modification d’un autre rédacteur en cas de révision dépassée", async () => {
        const authorization = docChannel();
        on("documents.findById", () => DOC());
        on("documents.latestRevision", () => REVISION({ revisionId: 10 }));
        const response = await request(createApp())
            .patch("/api/v1/channels/10/documents/4")
            .set("Authorization", authorization)
            .send({ body: "Version devenue obsolète", baseRevisionId: 9 });
        expect(response.status).toBe(409);
        expect(response.body.error.message).toMatch(/modifiée/);
    });

    it("refuse un message écrit, avec le libellé du mode", async () => {
        for (const [type, expected] of [
            ["wiki", /page/],
            ["faq", /question/],
            ["resources", /fiche/],
        ]) {
            const authorization = docChannel(type);
            const response = await request(createApp())
                .post("/api/v1/channels/10/messages")
                .set("Authorization", authorization)
                .send({ content: "un message" });

            expect(response.status).toBe(400);
            expect(response.body.error.message).toMatch(expected);
        }
    });

    it("crée la page et sa première révision d'un seul geste", async () => {
        const authorization = docChannel();
        on("documents.nextPosition", () => ({ position: 1 }));
        on("documents.create", () => ({ insertId: 4 }));
        let revision = null;
        on("documents.addRevision", (params) => {
            revision = params;
            return { affectedRows: 1 };
        });
        on("documents.findById", () => DOC());
        on("documents.latestRevision", () => REVISION());

        const response = await request(createApp())
            .post("/api/v1/channels/10/documents")
            .set("Authorization", authorization)
            .send({ title: "Poser une charpente", body: "Commencer par l'entrait." });

        expect(response.status).toBe(201);
        expect(revision[1]).toBe("Commencer par l'entrait.");
        expect(revision[2]).toBe("Création");
    });

    it("masque un secret collé dans une page comme dans un message", async () => {
        const authorization = docChannel();
        on("documents.nextPosition", () => ({ position: 1 }));
        on("documents.create", () => ({ insertId: 4 }));
        let stored = null;
        on("documents.addRevision", (params) => {
            stored = params;
            return { affectedRows: 1 };
        });
        on("documents.findById", () => DOC());
        on("documents.latestRevision", () => REVISION());

        const response = await request(createApp())
            .post("/api/v1/channels/10/documents")
            .set("Authorization", authorization)
            .send({ title: "Déploiement", body: "utiliser AKIAIOSFODNN7EXAMPLE puis relancer" });

        expect(response.status).toBe(201);
        expect(stored[1]).not.toContain("AKIAIOSFODNN7EXAMPLE");
        expect(response.body.redactedSecrets).toBe(1);
    });

    it("ne descend que les titres dans le sommaire", async () => {
        const authorization = docChannel();
        on("documents.listByChannel", () => [
            {
                ...DOC({ documentId: 1, title: "Entrait", position: 1 }),
                editorHandle: "redacteur",
                editorDisplayName: "Rédacteur",
            },
            {
                ...DOC({ documentId: 2, title: "Faîtage", position: 2 }),
                editorHandle: "redacteur",
                editorDisplayName: "Rédacteur",
            },
        ]);

        const response = await request(createApp())
            .get("/api/v1/channels/10/documents")
            .set("Authorization", authorization);

        expect(response.status).toBe(200);
        expect(response.body.documents.map((doc) => doc.title)).toEqual(["Entrait", "Faîtage"]);
        expect(response.body.documents[0].body).toBeUndefined();
    });

    it("une modification ajoute une révision au lieu d'écraser", async () => {
        const authorization = docChannel();
        on("documents.findById", () => DOC());
        let revision = null;
        on("documents.addRevision", (params) => {
            revision = params;
            return { affectedRows: 1 };
        });
        on("documents.update", () => ({ affectedRows: 1 }));
        on("documents.latestRevision", () => REVISION({ revisionId: 10, body: "Corrigé." }));

        const response = await request(createApp())
            .patch("/api/v1/channels/10/documents/4")
            .set("Authorization", authorization)
            .send({ body: "Corrigé.", summary: "Précision sur l'entrait" });

        expect(response.status).toBe(200);
        expect(revision[2]).toBe("Précision sur l'entrait");
        expect(response.body.body).toBe("Corrigé.");
    });

    it("refuse une page d'un autre salon", async () => {
        const authorization = docChannel();
        on("documents.findById", () => DOC({ channelId: 42 }));

        const response = await request(createApp())
            .get("/api/v1/channels/10/documents/4")
            .set("Authorization", authorization);

        expect(response.status).toBe(404);
    });

    it("revenir en arrière réécrit l'ancien corps sans effacer le chemin parcouru", async () => {
        const authorization = docChannel();
        on("documents.findById", () => DOC());
        on("documents.findRevision", () => ({ revisionId: 9, documentId: 4, body: "Version d'origine.", editedBy: 5 }));
        let restored = null;
        on("documents.addRevision", (params) => {
            restored = params;
            return { affectedRows: 1 };
        });
        on("documents.update", () => ({ affectedRows: 1 }));
        on("documents.latestRevision", () => REVISION({ revisionId: 11, body: "Version d'origine." }));

        const response = await request(createApp())
            .post("/api/v1/channels/10/documents/4/restore")
            .set("Authorization", authorization)
            .send({ revisionId: 9 });

        expect(response.status).toBe(200);
        expect(restored[1]).toBe("Version d'origine.");
        expect(restored[2]).toBe("Retour à la révision 9");
    });

    it("sert l'historique du plus récent au plus ancien", async () => {
        const authorization = docChannel();
        on("documents.findById", () => DOC());
        on("documents.listRevisions", (params) => {
            expect(params).toEqual([4, 50]);
            return [REVISION({ revisionId: 11 }), REVISION({ revisionId: 9 })];
        });

        const response = await request(createApp())
            .get("/api/v1/channels/10/documents/4/history")
            .set("Authorization", authorization);

        expect(response.status).toBe(200);
        expect(response.body.revisions.map((r) => r.revisionId)).toEqual([11, 9]);
        expect(response.body.revisions[0].editor.handle).toBe("redacteur");
    });
});
