"use strict";

const request = require("supertest");

const createApp = require("../../src/app");
const { on } = require("../helpers/db");
const { makeUser, authenticateAs } = require("../helpers/auth");
const { allowWrite } = require("../helpers/writePath");
const taskService = require("../../src/services/taskService");

const author = makeUser({ userId: 5, handle: "auteur" });
const other = makeUser({ userId: 6, handle: "autre" });

function taskChannel(user = author) {
    on("access.resolveChannel", () => ({ channelId: 10, guildId: 7, type: "task", name: "tâches", position: 0 }));
    on("access.channelPermission", () => [{ ownerId: 99, baseEffect: "allow", targetType: null, overrideEffect: null }]);
    on("access.guildRole", () => ({ role: "member" }));
    allowWrite();
    return authenticateAs(author, other)(user);
}

const ROW = (overrides = {}) => ({
    taskId: 4, channelId: 10, guildId: 7, title: "Poser la charpente", details: "", status: "todo",
    assigneeId: null, dueAt: null, position: 1, createdBy: 5, createdAt: new Date(), completedAt: null, ...overrides,
});

describe("Salon tâches", () => {
    it("refuse un message écrit : on y crée une tâche", async () => {
        const authorization = taskChannel();

        const response = await request(createApp())
            .post("/api/v1/channels/10/messages")
            .set("Authorization", authorization)
            .send({ content: "faut poser la charpente" });

        expect(response.status).toBe(400);
        expect(response.body.error.message).toMatch(/créez-en une/);
    });

    it("place une tâche neuve en fin de la colonne « à faire »", async () => {
        const authorization = taskChannel();
        on("tasks.nextPosition", (params) => {
            expect(params).toEqual([10, "todo"]);
            return { position: 3 };
        });
        let created = null;
        on("tasks.create", (params) => {
            created = params;
            return { insertId: 4 };
        });
        on("tasks.findById", () => ROW({ position: 3 }));

        const response = await request(createApp())
            .post("/api/v1/channels/10/tasks")
            .set("Authorization", authorization)
            .send({ title: "Poser la charpente" });

        expect(response.status).toBe(201);
        expect(created[6]).toBe(3);
        expect(response.body.task.status).toBe("todo");
    });

    it("rend un tableau en colonnes déjà ordonnées par le serveur", async () => {
        const authorization = taskChannel();
        on("tasks.listByChannel", () => [
            ROW({ taskId: 1, status: "todo", position: 1 }),
            ROW({ taskId: 2, status: "doing", position: 1 }),
            ROW({ taskId: 3, status: "done", position: 1, completedAt: new Date() }),
        ]);

        const response = await request(createApp())
            .get("/api/v1/channels/10/tasks")
            .set("Authorization", authorization);

        expect(response.status).toBe(200);
        expect(Object.keys(response.body.columns)).toEqual(["todo", "doing", "done"]);
        expect(response.body.columns.doing[0].taskId).toBe(2);
    });

    it("déplacer une tâche la met en fin de sa colonne d'arrivée", async () => {
        const authorization = taskChannel();
        on("tasks.findById", () => ROW({ status: "todo" }));
        on("tasks.nextPosition", (params) => {
            expect(params).toEqual([10, "doing"]);
            return { position: 7 };
        });
        let fields = null;
        on("tasks.update", (params) => {
            fields = params;
            return { affectedRows: 1 };
        });

        const response = await request(createApp())
            .patch("/api/v1/channels/10/tasks/4")
            .set("Authorization", authorization)
            .send({ status: "doing" });

        expect(response.status).toBe(200);
        expect(fields).toContain("doing");
        expect(fields).toContain(7);
    });

    it("horodate l'achèvement une seule fois", async () => {
        const authorization = taskChannel();
        const completedAt = new Date("2026-08-01T10:00:00Z");
        on("tasks.findById", () => ROW({ status: "done", completedAt }));
        on("tasks.nextPosition", () => ({ position: 1 }));
        let fields = null;
        on("tasks.update", (params) => {
            fields = params;
            return { affectedRows: 1 };
        });

        await request(createApp())
            .patch("/api/v1/channels/10/tasks/4")
            .set("Authorization", authorization)
            .send({ status: "done" });

        expect(fields.some((value) => value instanceof Date)).toBe(false);
    });

    it("réserve la suppression à la personne qui a créé la tâche", async () => {
        const authorization = taskChannel(other);
        on("tasks.findById", () => ROW({ createdBy: 5 }));

        const response = await request(createApp())
            .delete("/api/v1/channels/10/tasks/4")
            .set("Authorization", authorization);

        expect(response.status).toBe(403);
    });

    it("refuse une échéance illisible", async () => {
        const authorization = taskChannel();

        const response = await request(createApp())
            .post("/api/v1/channels/10/tasks")
            .set("Authorization", authorization)
            .send({ title: "Tâche", dueAt: "pas une date" });

        expect(response.status).toBe(400);
    });

    it("déduit le retard de l'échéance, et jamais pour une tâche terminée", () => {
        const yesterday = new Date(Date.now() - 86_400_000);
        const tomorrow = new Date(Date.now() + 86_400_000);

        expect(taskService.isOverdue({ status: "todo", dueAt: yesterday })).toBe(true);
        expect(taskService.isOverdue({ status: "doing", dueAt: tomorrow })).toBe(false);
        expect(taskService.isOverdue({ status: "done", dueAt: yesterday })).toBe(false);
        expect(taskService.isOverdue({ status: "todo", dueAt: null })).toBe(false);
    });
});
