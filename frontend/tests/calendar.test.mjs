import assert from "node:assert/strict";
import test from "node:test";
import { calendarEvent, localDateTime } from "../src/lib/calendar.js";

test("un export conserve l’instant avec son décalage horaire", () => {
    const text = calendarEvent({
        channelId: 3,
        eventId: 7,
        title: "Rencontre",
        startsAt: "2026-09-10T14:00:00+02:00",
        endsAt: "2026-09-10T15:00:00+02:00",
    });
    assert.match(text, /DTSTART:20260910T120000Z/);
    assert.match(text, /DTEND:20260910T130000Z/);
});

test("les sauts de ligne et séparateurs restent du texte dans le calendrier", () => {
    const text = calendarEvent({
        channelId: 3,
        eventId: 7,
        title: "Atelier\rBEGIN:VEVENT",
        description: "Une ligne\r\nUne autre, suite; fin",
        startsAt: "2026-09-10T12:00:00Z",
    });
    assert.equal(text.split("\r\n").filter((line) => line === "BEGIN:VEVENT").length, 1);
    assert.ok(text.includes("SUMMARY:Atelier\\nBEGIN:VEVENT"));
    assert.ok(text.includes("DESCRIPTION:Une ligne\\nUne autre\\, suite\\; fin"));
});

test("une date absente ou invalide ne remplit pas le formulaire", () => {
    assert.equal(localDateTime(null), "");
    assert.equal(localDateTime("invalide"), "");
});
