"use strict";

const { tokenize, scoreText, rank, METHOD } = require("../../src/domain/lexicalOverlap");

describe("Recouvrement lexical", () => {
    it("expose le nom de la méthode", () => {
        expect(METHOD).toBe("lexical-overlap");
    });

    it("ignore les enveloppes chiffrées", () => {
        expect(scoreText("qw1:abcdef", ["revue"])).toBe(0);
    });

    it("classe le message qui recouvre le plus de mots", () => {
        const tokens = tokenize("revue worktree");
        const ranked = rank(
            [{ content: "bonjour tout le monde" }, { content: "la revue du worktree est prête" }],
            tokens,
            10
        );
        expect(ranked[0].row.content).toMatch(/worktree/);
        expect(ranked[0].score).toBe(1);
    });

    it("n'invente aucun embedding", () => {
        expect(String(tokenize)).not.toMatch(/embed|vector/i);
    });
});
