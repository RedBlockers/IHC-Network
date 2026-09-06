"use strict";

const channelModes = require("../../src/domain/channelModes");
const service = require("../../src/services/channelModeService");

describe("Modes de salon personnalisés", () => {
    it("hérite du mode de base pour tout ce qui n'est pas ajusté", () => {
        const forum = channelModes.MODES.forum;
        const resolved = channelModes.resolveMode("forum", {
            modeId: 3,
            name: "Candidatures",
            acceptsMessages: null,
            requiresThread: null,
            requiresPoll: null,
            requiresAttachment: null,
            pinnedFirst: null,
            refusal: null,
        });

        expect(resolved.requiresThread).toBe(forum.requiresThread);
        expect(resolved.label).toBe("Candidatures");
        expect(resolved.baseType).toBe("forum");
    });

    it("n'écrase que les leviers explicitement posés", () => {
        const resolved = channelModes.resolveMode("text", {
            modeId: 4,
            name: "Annonces internes",
            acceptsMessages: false,
            requiresThread: null,
            requiresPoll: null,
            requiresAttachment: null,
            pinnedFirst: true,
            refusal: "Ce salon ne reçoit que les annonces du conseil.",
        });

        expect(resolved.acceptsMessages).toBe(false);
        expect(resolved.pinnedFirst).toBe(true);
        expect(resolved.refusal).toMatch(/conseil/);
    });

    it("refuse un mode de départ inconnu", () => {
        expect(() => service.clean({ name: "Essai", baseType: "inexistant" })).toThrow(/mode de départ/i);
    });

    it("exige un nom lisible", () => {
        expect(() => service.clean({ name: "x", baseType: "text" })).toThrow(/nom/i);
    });

    it("n'ouvre que les leviers prévus, jamais du comportement libre", () => {
        const cleaned = service.clean({
            name: "Vitrine",
            baseType: "gallery",
            voice: true,
            document: true,
            postPermission: "ADMINISTRATOR",
        });

        expect(cleaned.voice).toBeUndefined();
        expect(cleaned.document).toBeUndefined();
        expect(cleaned.postPermission).toBeUndefined();
        expect(Object.keys(cleaned).sort()).toEqual(
            ["acceptsMessages", "baseType", "icon", "name", "pinnedFirst", "refusal", "requiresAttachment", "requiresPoll", "requiresThread"].sort()
        );
    });

    it("laisse le type du salon décider du moteur", () => {
        const resolved = channelModes.resolveMode("text", { modeId: 5, name: "Bavardage", acceptsMessages: null });
        expect(channelModes.isVoice(resolved.baseType ?? "text")).toBe(false);
    });

    it("le refus personnalisé remplace bien celui du mode de base", () => {
        const base = channelModes.resolveMode("forum", null);
        const custom = channelModes.resolveMode("forum", {
            modeId: 9,
            name: "Candidatures",
            refusal: "Ouvrez un fil : une candidature par fil.",
        });

        expect(custom.refusal).not.toBe(base.refusal);
        expect(custom.refusal).toMatch(/une candidature par fil/);
    });
});
