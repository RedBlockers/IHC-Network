"use strict";

const request = require("supertest");

const createApp = require("../../src/app");
const { on } = require("../helpers/db");
const { makeUser, authenticateAs } = require("../helpers/auth");
const { allowWrite } = require("../helpers/writePath");

const member = makeUser({ userId: 5, handle: "membre" });
const agent = makeUser({ userId: 8, handle: "support" });
const stranger = makeUser({ userId: 9, handle: "curieux" });

function ticketChannel(user, { support = false } = {}) {
    on("access.resolveChannel", () => ({ channelId: 10, guildId: 7, type: "ticket", name: "support", position: 0 }));
    on("access.channelPermission", (params) => [
        {
            ownerId: 99,
            baseEffect: params[1] === "MODERATE_MEMBERS" && !support ? "deny" : "allow",
            targetType: null,
            overrideEffect: null,
        },
    ]);
    on("access.guildRole", () => ({ role: "member" }));
    allowWrite();
    return authenticateAs(member, agent, stranger)(user);
}

const TICKET = (overrides = {}) => ({
    ticketId: 3,
    channelId: 10,
    guildId: 7,
    number: 12,
    title: "Objet perdu",
    status: "open",
    openedBy: 5,
    assigneeId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
});

describe("Salon tickets", () => {
    it("refuse un message écrit : on y ouvre une demande", async () => {
        const authorization = ticketChannel(member);

        const response = await request(createApp())
            .post("/api/v1/channels/10/messages")
            .set("Authorization", authorization)
            .send({ content: "j'ai un souci" });

        expect(response.status).toBe(400);
        expect(response.body.error.message).toMatch(/ouvrez une demande/);
    });

    it("numérote le ticket dans le salon et enregistre le premier message", async () => {
        const authorization = ticketChannel(member);
        on("tickets.lockChannel", () => ({ channelId: 10 }));
        on("tickets.nextNumber", () => ({ number: 12 }));
        let created = null;
        let first = null;
        on("tickets.create", (params) => {
            created = params;
            return { insertId: 3 };
        });
        on("tickets.addMessage", (params) => {
            first = params;
            return { affectedRows: 1 };
        });
        on("tickets.findById", () => TICKET());

        const response = await request(createApp())
            .post("/api/v1/channels/10/tickets")
            .set("Authorization", authorization)
            .send({ title: "Objet perdu", body: "j'ai perdu mon épée dans la taverne" });

        expect(response.status).toBe(201);
        expect(created).toEqual([10, 7, 12, "Objet perdu", 5, "normal"]);
        expect(first[3]).toBe(0);
        expect(response.body.ticket.number).toBe(12);
    });

    it("ne montre à un membre que ses propres tickets", async () => {
        const authorization = ticketChannel(member);
        let filters = null;
        on("tickets.listByChannel", (params) => {
            filters = params;
            return [];
        });

        const response = await request(createApp())
            .get("/api/v1/channels/10/tickets")
            .set("Authorization", authorization);

        expect(response.status).toBe(200);
        expect(response.body.support).toBe(false);
        expect(filters).toContain(5);
    });

    it("sert la file entière à l'équipe", async () => {
        const authorization = ticketChannel(agent, { support: true });
        let filters = null;
        on("tickets.listByChannel", (params) => {
            filters = params;
            return [];
        });

        const response = await request(createApp())
            .get("/api/v1/channels/10/tickets")
            .set("Authorization", authorization);

        expect(response.status).toBe(200);
        expect(response.body.support).toBe(true);
        expect(filters).not.toContain(8);
    });

    it("répond « introuvable » sur le ticket d'un autre, sans confirmer qu'il existe", async () => {
        const authorization = ticketChannel(stranger);
        on("tickets.findById", () => TICKET({ openedBy: 5 }));

        const response = await request(createApp())
            .get("/api/v1/channels/10/tickets/3")
            .set("Authorization", authorization);

        expect(response.status).toBe(404);
        expect(response.body.error.message).toBe("Ticket introuvable.");
    });

    it("cache les notes internes à la personne qui a ouvert le ticket", async () => {
        const authorization = ticketChannel(member);
        on("tickets.findById", () => TICKET());
        let includeInternal = null;
        on("tickets.listMessages", (params, sql) => {
            includeInternal = sql.includes("internal = 0");
            return [];
        });

        const response = await request(createApp())
            .get("/api/v1/channels/10/tickets/3")
            .set("Authorization", authorization);

        expect(response.status).toBe(200);
        expect(includeInternal).toBe(true);
        expect(response.body.support).toBe(false);
    });

    it("refuse une note interne à qui n'est pas de l'équipe", async () => {
        const authorization = ticketChannel(member);
        on("tickets.findById", () => TICKET());

        const response = await request(createApp())
            .post("/api/v1/channels/10/tickets/3/messages")
            .set("Authorization", authorization)
            .send({ body: "note discrète", internal: true });

        expect(response.status).toBe(403);
    });

    it("refuse de répondre dans un ticket clos", async () => {
        const authorization = ticketChannel(agent, { support: true });
        on("tickets.findById", () => TICKET({ status: "closed" }));

        const response = await request(createApp())
            .post("/api/v1/channels/10/tickets/3/messages")
            .set("Authorization", authorization)
            .send({ body: "encore une chose" });

        expect(response.status).toBe(403);
    });

    it("laisse le demandeur refermer sa demande mais pas la marquer résolue", async () => {
        const authorization = ticketChannel(member);
        on("tickets.findById", () => TICKET());
        on("tickets.update", () => ({ affectedRows: 1 }));
        on("moderation.appendAudit", () => ({ insertId: 1 }));

        const resolved = await request(createApp())
            .patch("/api/v1/channels/10/tickets/3/status")
            .set("Authorization", authorization)
            .send({ status: "resolved" });
        expect(resolved.status).toBe(403);

        const closed = await request(createApp())
            .patch("/api/v1/channels/10/tickets/3/status")
            .set("Authorization", authorization)
            .send({ status: "closed" });
        expect(closed.status).toBe(200);
    });

    it("consigne au journal d'audit chaque changement de statut et d'attribution", async () => {
        const authorization = ticketChannel(agent, { support: true });
        on("tickets.findById", () => TICKET());
        on("tickets.update", () => ({ affectedRows: 1 }));

        const entries = [];
        on("moderation.appendAudit", (params) => {
            entries.push(params[2]);
            return { insertId: entries.length };
        });

        await request(createApp())
            .patch("/api/v1/channels/10/tickets/3/status")
            .set("Authorization", authorization)
            .send({ status: "resolved" });

        await request(createApp())
            .put("/api/v1/channels/10/tickets/3/assignee")
            .set("Authorization", authorization)
            .send({ assigneeId: 8 });

        expect(entries).toEqual(["ticket.resolved", "ticket.assign"]);
    });

    it("réserve l'attribution à l'équipe", async () => {
        const authorization = ticketChannel(member);
        on("tickets.findById", () => TICKET());

        const response = await request(createApp())
            .put("/api/v1/channels/10/tickets/3/assignee")
            .set("Authorization", authorization)
            .send({ assigneeId: 8 });

        expect(response.status).toBe(403);
    });

    it("refuse d'attribuer une demande à une personne sans accès au support", async () => {
        const authorization = ticketChannel(agent, { support: true });
        on("tickets.findById", () => TICKET());
        on("access.channelPermission", (params) => [
            {
                ownerId: 99,
                baseEffect: params[0] === 9 ? "deny" : "allow",
                targetType: null,
                overrideEffect: null,
            },
        ]);
        const response = await request(createApp())
            .put("/api/v1/channels/10/tickets/3/assignee")
            .set("Authorization", authorization)
            .send({ assigneeId: 9 });
        expect(response.status).toBe(400);
        expect(response.body.error.message).toMatch(/équipe/);
    });

    it("une note interne conserve le statut de la demande", async () => {
        const authorization = ticketChannel(agent, { support: true });
        on("tickets.findById", () => TICKET({ status: "resolved" }));
        on("tickets.addMessage", () => ({ insertId: 10 }));
        on("tickets.listMessages", () => []);
        let updated = null;
        on("tickets.update", (params, sql) => {
            updated = sql;
            return { affectedRows: 1 };
        });
        const response = await request(createApp())
            .post("/api/v1/channels/10/tickets/3/messages")
            .set("Authorization", authorization)
            .send({ body: "Contexte réservé à l’équipe.", internal: true });
        expect(response.status).toBe(201);
        expect(updated).not.toMatch(/status =/);
    });

    it("refuse de créer des tickets dans un salon textuel", async () => {
        const authorization = ticketChannel(member);
        on("access.resolveChannel", () => ({ channelId: 10, guildId: 7, type: "text" }));
        const response = await request(createApp())
            .post("/api/v1/channels/10/tickets")
            .set("Authorization", authorization)
            .send({ title: "Demande", body: "Bonjour, j’ai une question." });
        expect(response.status).toBe(400);
    });
});
