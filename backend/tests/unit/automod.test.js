"use strict";

const { evaluate, evaluateRate, evaluateRaid, normalize, hostsIn, parseList } = require("../../src/domain/automod");

const WORDS = { blockedWords: ["idiot", "arnaque"] };
const DOMAINS = { blockedDomains: ["exemple-arnaque.fr"] };

describe("Filtres automatiques", () => {
    it("normalise les contournements courants", () => {
        expect(normalize("Idiiiiot")).toBe("idiot");
        expect(normalize("ARNAQUE")).toBe("arnaque");
        expect(normalize("créé")).toBe("cre");
        expect(normalize("1d10t")).toBe("idiot");
        expect(normalize("sommes")).toBe("somes");
    });

    it("reconnaît un terme filtré malgré accents, casse et substitutions", () => {
        for (const text of ["tu es un idiot", "TU ES UN IDIOT", "tu es un 1d10t", "tu es un idioooot"]) {
            const verdict = evaluate(text, WORDS);
            expect(verdict).not.toBeNull();
            expect(verdict.rule).toBe("words");
        }
    });

    it("ne déclenche pas sur un mot qui en contient un autre", () => {
        expect(evaluate("le concert de ce soir", { blockedWords: ["con"] })).toBeNull();
        expect(evaluate("cette classe est bruyante", { blockedWords: ["ass"] })).toBeNull();
        expect(evaluate("idiotie", WORDS)).toBeNull();
    });

    it("nomme la règle et le terme dans une phrase affichable", () => {
        const verdict = evaluate("c'est une arnaque", WORDS);
        expect(verdict.reason).toBe("Le message contient un terme filtré par la communauté (« arnaque »).");
        expect(verdict.match).toBe("arnaque");
    });

    it("repère les domaines cités, sous-domaines compris", () => {
        expect(hostsIn("va sur https://a.b.exemple.fr/page et sur autre.com")).toEqual(["a.b.exemple.fr", "autre.com"]);

        const verdict = evaluate("clique ici https://promo.exemple-arnaque.fr/gagner", DOMAINS);
        expect(verdict.rule).toBe("domains");
        expect(verdict.match).toBe("promo.exemple-arnaque.fr");
    });

    it("ne confond pas un domaine avec un autre qui s'y termine par hasard", () => {
        expect(evaluate("rendez-vous sur pasexemple-arnaque.fr", DOMAINS)).toBeNull();
    });

    it("laisse passer un message ordinaire", () => {
        expect(evaluate("la taverne ouvre à 21 h", { ...WORDS, ...DOMAINS })).toBeNull();
        expect(evaluate("", WORDS)).toBeNull();
        expect(evaluate("bonjour", {})).toBeNull();
    });

    it("ne déclenche le débit qu'au-delà du seuil, et seulement s'il est réglé", () => {
        const config = { spamMessages: 5, spamSeconds: 10 };
        expect(evaluateRate(5, config)).toBeNull();
        expect(evaluateRate(6, config).rule).toBe("spam");
        expect(evaluateRate(6, config).reason).toBe("Plus de 5 messages en 10 secondes.");
        expect(evaluateRate(9999, {})).toBeNull();
    });

    it("applique la même prudence aux arrivées massives", () => {
        const config = { raidJoins: 10, raidSeconds: 60 };
        expect(evaluateRaid(10, config)).toBeNull();
        expect(evaluateRaid(11, config).rule).toBe("raid");
        expect(evaluateRaid(11, config).reason).toBe("Plus de 10 arrivées en 60 secondes.");
        expect(evaluateRaid(9999, {})).toBeNull();
    });

    it("lit une liste saisie à la main, ligne à ligne ou par virgules", () => {
        expect(parseList("idiot\narnaque\n\n  spam  ")).toEqual(["idiot", "arnaque", "spam"]);
        expect(parseList("a.fr, b.fr")).toEqual(["a.fr", "b.fr"]);
        expect(parseList("")).toEqual([]);
        expect(parseList(null)).toEqual([]);
    });
});
