"use strict";

const { summarize, METHOD } = require("../../src/domain/extractiveSummary");

describe("Résumé extractif", () => {
    it("expose le nom de la méthode", () => {
        expect(METHOD).toBe("extractive");
    });

    it("ne fabrique aucune phrase : il en reprend", () => {
        const first = "La revue du worktree est prête pour demain matin.";
        const second = "La revue du worktree avance bien aujourd'hui.";
        const result = summarize([first, second, "ok"]);
        expect(result.method).toBe("extractive");
        expect(result.body).toContain("revue du worktree");
        expect(result.body.includes(first) || result.body.includes(second)).toBe(true);
    });

    it("ignore les enveloppes chiffrées", () => {
        const result = summarize(["QW1:abcdef", "qw1:zzzz"]);
        expect(result.body).toBe("");
        expect(result.messageCount).toBe(0);
    });
});
