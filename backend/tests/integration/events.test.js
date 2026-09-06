"use strict";

const request = require("supertest");

const createApp = require("../../src/app");
const { on } = require("../helpers/db");
const { makeUser, authenticateAs } = require("../helpers/auth");
const { allowWrite } = require("../helpers/writePath");
const eventService = require("../../src/services/eventService");

const author = makeUser({ userId: 5, handle: "organisateur" });
const other = makeUser({ userId: 6, handle: "invite" });

function eventChannel(user = author) {
    on("access.resolveChannel", () => ({ channelId: 10, guildId: 7, type: "event", name: "événements", position: 0 }));
    on("access.channelPermission", () => [
        { ownerId: 99, baseEffect: "allow", targetType: null, overrideEffect: null },
    ]);
    on("access.guildRole", () => ({ role: "member" }));
    allowWrite();
    return authenticateAs(author, other)(user);
}

const ROW = (overrides = {}) => ({
    eventId: 3,
    channelId: 10,
    guildId: 7,
    title: "Grande expédition",
    description: "",
    location: "place centrale",
    startsAt: new Date(Date.now() + 86_400_000),
    endsAt: null,
    createdBy: 5,
    cancelledAt: null,
    createdAt: new Date(),
    ...overrides,
});

describe("Salon événements", () => {
    it("valide et enregistre une modification de la fin seule", async () => {
        const authorization = eventChannel();
        const start = new Date(Date.now() + 86_400_000);
        const end = new Date(start.getTime() + 3_600_000).toISOString();
        on("events.findById", () => ROW({ startsAt: start }));
        on("events.listInterested", () => []);
        on("events.tally", () => []);
        on("events.responseOf", () => null);
        let saved = null;
        on("events.update", (params) => {
            saved = params;
            return { affectedRows: 1 };
        });
        const response = await request(createApp())
            .patch("/api/v1/channels/10/events/3")
            .set("Authorization", authorization)
            .send({ endsAt: end });
        expect(response.status).toBe(200);
        expect(saved).toContainEqual(new Date(end));
    });

    it("refuse une fin seule située avant le début existant", async () => {
        const authorization = eventChannel();
        on("events.findById", () => ROW());
        const response = await request(createApp())
            .patch("/api/v1/channels/10/events/3")
            .set("Authorization", authorization)
            .send({ endsAt: new Date().toISOString() });
        expect(response.status).toBe(400);
        expect(response.body.error.message).toMatch(/doit suivre/);
    });

    it("refuse un message écrit : on y propose une date, pas un message", async () => {
        const authorization = eventChannel();

        const response = await request(createApp())
            .post("/api/v1/channels/10/messages")
            .set("Authorization", authorization)
            .send({ content: "on se voit quand ?" });

        expect(response.status).toBe(400);
        expect(response.body.error.message).toMatch(/proposez-en un/);
    });

    it("refuse une fin antérieure au début", async () => {
        const authorization = eventChannel();
        const start = new Date(Date.now() + 86_400_000).toISOString();
        const end = new Date(Date.now() + 3_600_000).toISOString();

        const response = await request(createApp())
            .post("/api/v1/channels/10/events")
            .set("Authorization", authorization)
            .send({ title: "Expédition", startsAt: start, endsAt: end });

        expect(response.status).toBe(400);
        expect(response.body.error.message).toMatch(/doit suivre son début/);
    });

    it("inscrit d'office la personne qui propose l'événement", async () => {
        const authorization = eventChannel();
        on("events.create", () => ({ insertId: 3 }));
        on("events.findById", () => ROW());
        const responses = [];
        on("events.respond", (params) => {
            responses.push(params);
            return { affectedRows: 1 };
        });
        on("events.tally", () => [{ response: "going", total: 1 }]);
        on("events.responseOf", () => ({ response: "going" }));

        const response = await request(createApp())
            .post("/api/v1/channels/10/events")
            .set("Authorization", authorization)
            .send({ title: "Grande expédition", startsAt: new Date(Date.now() + 86_400_000).toISOString() });

        expect(response.status).toBe(201);
        expect(responses).toEqual([[3, 5, "going"]]);
        expect(response.body.event.going).toBe(1);
        expect(response.body.event.yourResponse).toBe("going");
    });

    it("remplace la réponse au lieu d'en ajouter une seconde", async () => {
        const authorization = eventChannel(other);
        on("events.findById", () => ROW());
        let stored = null;
        on("events.respond", (params) => {
            stored = params;
            return { affectedRows: 1 };
        });
        on("events.tally", () => [
            { response: "going", total: 1 },
            { response: "maybe", total: 1 },
        ]);
        on("events.responseOf", () => ({ response: "maybe" }));

        const response = await request(createApp())
            .put("/api/v1/channels/10/events/3/response")
            .set("Authorization", authorization)
            .send({ response: "maybe" });

        expect(response.status).toBe(200);
        expect(stored).toEqual([3, 6, "maybe"]);
        expect(response.body.event.yourResponse).toBe("maybe");
        expect(response.body.event.maybe).toBe(1);
    });

    it("refuse de répondre à un événement passé ou annulé", async () => {
        const authorization = eventChannel(other);

        on("events.findById", () => ROW({ startsAt: new Date(Date.now() - 7 * 86_400_000) }));
        const past = await request(createApp())
            .put("/api/v1/channels/10/events/3/response")
            .set("Authorization", authorization)
            .send({ response: "going" });
        expect(past.status).toBe(403);
        expect(past.body.error.message).toMatch(/passé/);

        on("events.findById", () => ROW({ cancelledAt: new Date() }));
        const cancelled = await request(createApp())
            .put("/api/v1/channels/10/events/3/response")
            .set("Authorization", authorization)
            .send({ response: "going" });
        expect(cancelled.status).toBe(403);
        expect(cancelled.body.error.message).toMatch(/annulé/);
    });

    it("réserve la modification et l'annulation à la personne qui a proposé", async () => {
        const authorization = eventChannel(other);
        on("events.findById", () => ROW({ createdBy: 5 }));

        const edit = await request(createApp())
            .patch("/api/v1/channels/10/events/3")
            .set("Authorization", authorization)
            .send({ title: "Autre titre" });
        expect(edit.status).toBe(403);

        const remove = await request(createApp())
            .delete("/api/v1/channels/10/events/3")
            .set("Authorization", authorization);
        expect(remove.status).toBe(403);
    });

    it("prévient les personnes annoncées lors d'une annulation, sauf l'auteur et les absents", async () => {
        const authorization = eventChannel();
        on("events.findById", () => ROW());
        on("events.cancel", () => ({ affectedRows: 1 }));
        on("events.listInterested", () => [{ userId: 5 }, { userId: 6 }, { userId: 7 }]);

        const notified = [];
        on("notifications.create", (params) => {
            notified.push(params[0]);
            return { insertId: notified.length, affectedRows: 1 };
        });
        on("notifications.findByIdForUser", () => null);

        const response = await request(createApp())
            .delete("/api/v1/channels/10/events/3")
            .set("Authorization", authorization);

        expect(response.status).toBe(200);
        expect(response.body.status).toBe("cancelled");
        expect(notified.sort()).toEqual([6, 7]);
    });

    it("déduit l'état des dates plutôt que de le stocker", () => {
        const hour = 3_600_000;
        expect(eventService.statusOf({ startsAt: new Date(Date.now() + hour), endsAt: null })).toBe("upcoming");
        expect(eventService.statusOf({ startsAt: new Date(Date.now() - hour), endsAt: null })).toBe("live");
        expect(eventService.statusOf({ startsAt: new Date(Date.now() - 5 * hour), endsAt: null })).toBe("past");
        expect(eventService.statusOf({ startsAt: new Date(), cancelledAt: new Date() })).toBe("cancelled");
    });
});
