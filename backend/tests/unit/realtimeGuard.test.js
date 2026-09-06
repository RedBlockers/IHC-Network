"use strict";

const { consumeEventBudget, canEmitTyping } = require("../../src/realtime/eventGuard");

describe("garde-fous temps réel", () => {
    it("n'autorise l'indicateur de saisie que dans une room déjà rejointe", () => {
        const socket = { rooms: new Set(["channel:10"]), data: {} };

        expect(canEmitTyping(socket, 10, 1_000)).toBe(true);
        expect(canEmitTyping(socket, 11, 1_000)).toBe(false);
        expect(canEmitTyping(socket, -1, 1_000)).toBe(false);
    });

    it("borne les événements répétés par socket", () => {
        const socket = { data: {} };

        expect(consumeEventBudget(socket, "subscribe", 2, 10_000, 1_000)).toBe(true);
        expect(consumeEventBudget(socket, "subscribe", 2, 10_000, 1_001)).toBe(true);
        expect(consumeEventBudget(socket, "subscribe", 2, 10_000, 1_002)).toBe(false);
        expect(consumeEventBudget(socket, "subscribe", 2, 10_000, 11_001)).toBe(true);
    });
});
