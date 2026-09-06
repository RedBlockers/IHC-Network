import assert from "node:assert/strict";
import test from "node:test";

import { announce, reset, subscribe } from "../src/lib/announce.js";

test("un message est transmis aux abonnés", () => {
    reset();
    const seen = [];
    const stop = subscribe((message) => seen.push(message));

    announce("Salon général.");

    assert.equal(seen.at(-1), "Salon général.");
    stop();
});

test("le même message deux fois de suite repasse par le vide", () => {
    reset();
    const seen = [];
    const stop = subscribe((message) => seen.push(message));

    announce("Micro coupé.");
    announce("Micro coupé.");

    const index = seen.lastIndexOf("Micro coupé.");
    assert.equal(seen[index - 1], "");
    stop();
});

test("deux messages différents ne passent pas par le vide", () => {
    reset();
    const seen = [];
    const stop = subscribe((message) => seen.push(message));

    announce("Micro coupé.");
    announce("Micro activé.");

    const index = seen.lastIndexOf("Micro activé.");
    assert.equal(seen[index - 1], "Micro coupé.");
    stop();
});

test("un message vide n'annonce rien", () => {
    reset();
    const seen = [];
    const stop = subscribe((message) => seen.push(message));
    const before = seen.length;

    announce("");
    announce("   ");
    announce(null);

    assert.equal(seen.length, before);
    stop();
});

test("un abonné reçoit l'état courant en s'abonnant", () => {
    reset();
    announce("Connecté au salon vocal.");

    let received = null;
    const stop = subscribe((message) => { received = message; });

    assert.equal(received, "Connecté au salon vocal.");
    stop();
});

test("se désabonner coupe la réception", () => {
    reset();
    const seen = [];
    const stop = subscribe((message) => seen.push(message));
    stop();

    announce("Salon vocal quitté.");

    assert.ok(!seen.includes("Salon vocal quitté."));
});
