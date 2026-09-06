"use strict";

const service = require("../../src/services/notificationSettingsService");

const { resolveLevel, inQuietHours } = service;

describe("Résolution des niveaux de notification", () => {
    const CONTEXT = { channelId: 10, guildId: 7 };

    it("retombe sur le défaut quand rien n'est réglé", () => {
        expect(resolveLevel([], CONTEXT)).toEqual({ level: "all", from: "default" });
    });

    it("applique le réglage de la communauté à défaut de réglage de salon", () => {
        const rows = [{ scope: "guild", targetId: 7, level: "mentions" }];
        expect(resolveLevel(rows, CONTEXT)).toEqual({ level: "mentions", from: "guild" });
    });

    it("donne la priorité au réglage du salon", () => {
        const rows = [
            { scope: "guild", targetId: 7, level: "none" },
            { scope: "channel", targetId: 10, level: "all" },
        ];
        expect(resolveLevel(rows, CONTEXT)).toEqual({ level: "all", from: "channel" });
    });

    it("traite « hériter » comme une absence de décision, pas comme un silence", () => {
        const rows = [
            { scope: "guild", targetId: 7, level: "mentions" },
            { scope: "channel", targetId: 10, level: "inherit" },
        ];
        expect(resolveLevel(rows, CONTEXT)).toEqual({ level: "mentions", from: "guild" });
    });

    it("ignore un réglage qui vise un autre salon ou une autre communauté", () => {
        const rows = [
            { scope: "channel", targetId: 99, level: "none" },
            { scope: "guild", targetId: 42, level: "none" },
        ];
        expect(resolveLevel(rows, CONTEXT)).toEqual({ level: "all", from: "default" });
    });
});

describe("Heures calmes", () => {
    it("n'existe pas tant qu'aucune plage n'est définie", () => {
        expect(inQuietHours({ quietHoursStart: null, quietHoursEnd: null }, 3)).toBe(false);
    });

    it("couvre une plage ordinaire dans la journée", () => {
        const range = { quietHoursStart: 9, quietHoursEnd: 17 };
        expect(inQuietHours(range, 8)).toBe(false);
        expect(inQuietHours(range, 9)).toBe(true);
        expect(inQuietHours(range, 16)).toBe(true);
        expect(inQuietHours(range, 17)).toBe(false);
    });

    it("couvre une plage qui enjambe minuit", () => {
        const night = { quietHoursStart: 22, quietHoursEnd: 7 };
        expect(inQuietHours(night, 23)).toBe(true);
        expect(inQuietHours(night, 2)).toBe(true);
        expect(inQuietHours(night, 6)).toBe(true);
        expect(inQuietHours(night, 7)).toBe(false);
        expect(inQuietHours(night, 12)).toBe(false);
    });

    it("traite une plage vide comme absente", () => {
        expect(inQuietHours({ quietHoursStart: 8, quietHoursEnd: 8 }, 8)).toBe(false);
    });
});
