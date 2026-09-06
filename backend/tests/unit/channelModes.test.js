"use strict";

const modes = require("../../src/domain/channelModes");

describe("Modes de salon", () => {
    it("garde le texte comme mode de référence, sans contrainte", () => {
        expect(modes.acceptsMessages("text")).toBe(true);
        expect(modes.postPermissionFor("text")).toBeNull();
        expect(modes.requiresThread("text")).toBe(false);
        expect(modes.requiresPoll("text")).toBe(false);
    });

    it("refuse l'écrit dans un salon vocal", () => {
        expect(modes.acceptsMessages("voice")).toBe(false);
        expect(modes.refusalFor("voice")).toMatch(/vocal/);
    });

    it("réserve la publication d'annonces sans fermer la réaction", () => {
        expect(modes.postPermissionFor("announcement")).toBe("MANAGE_MESSAGES");
        expect(modes.acceptsMessages("announcement")).toBe(true);
        expect(modes.refusalFor("announcement")).toMatch(/réagir/);
    });

    it("impose le fil dans un forum et le sondage dans un salon de sondages", () => {
        expect(modes.requiresThread("forum")).toBe(true);
        expect(modes.requiresPoll("poll")).toBe(true);
        expect(modes.requiresThread("poll")).toBe(false);
    });

    it("retombe sur le mode texte pour un type inconnu plutôt que de casser", () => {
        expect(modes.acceptsMessages("mode-inexistant")).toBe(true);
        expect(modes.modeOf("mode-inexistant").id).toBe("text");
    });

    it("regroupe les quatre modes documentaires derrière un même moteur", () => {
        for (const type of ["wiki", "documentation", "resources", "faq"]) {
            expect(modes.isDocument(type)).toBe(true);
            expect(modes.acceptsMessages(type)).toBe(false);
        }
        expect(modes.isDocument("text")).toBe(false);
        expect(modes.refusalFor("faq")).toMatch(/question/);
        expect(modes.refusalFor("wiki")).toMatch(/page/);
    });

    it("exige au moins un fichier dans une galerie", () => {
        expect(modes.requiresAttachment("gallery")).toBe(true);
        expect(modes.requiresAttachment("text")).toBe(false);
        expect(modes.acceptsMessages("gallery")).toBe(true);
        expect(modes.refusalFor("gallery")).toMatch(/joignez au moins un fichier/);
    });

    it("expose la liste des types acceptés par le schéma", () => {
        expect(modes.TYPES).toEqual(expect.arrayContaining(["text", "voice", "forum", "gallery", "poll"]));
        expect(new Set(modes.TYPES).size).toBe(modes.TYPES.length);
        for (const type of modes.TYPES) {
            expect(modes.modeOf(type).id).toBe(type);
        }
    });

    it("chaque mode qui contraint explique son refus", () => {
        for (const type of modes.TYPES) {
            const mode = modes.modeOf(type);
            const constrains =
                mode.acceptsMessages === false ||
                mode.requiresThread ||
                mode.requiresPoll ||
                mode.requiresAttachment ||
                mode.postPermission;

            if (constrains) expect(typeof mode.refusal).toBe("string");
        }
    });

    it("les traits d'affichage ne restreignent rien", () => {
        for (const type of ["incident", "ephemeral", "gated", "spoiler"]) {
            expect(modes.acceptsMessages(type)).toBe(true);
        }
    });

    it("une scène est un salon vocal", () => {
        expect(modes.isVoice("stage")).toBe(true);
        expect(modes.isStage("stage")).toBe(true);
        expect(modes.isStage("voice")).toBe(false);
    });

    it("le moteur vocal couvre vocal, vidéo et scène", () => {
        expect(modes.isVoice("voice")).toBe(true);
        expect(modes.isVoice("video")).toBe(true);
        expect(modes.isVoice("stage")).toBe(true);
        expect(modes.expectsCamera("video")).toBe(true);
        expect(modes.expectsCamera("voice")).toBe(false);
        expect(modes.isVoice("text")).toBe(false);
    });
});
