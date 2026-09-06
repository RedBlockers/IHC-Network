"use strict";

const { scan, redact, hasSecret } = require("../../src/domain/secretScanner");

describe("Détection de secrets", () => {
    it("repère les jetons de fournisseurs connus", () => {
        const cases = [
            ["AKIAIOSFODNN7EXAMPLE", "aws-access-key"],
            ["ghp_abcdefghijklmnopqrstuvwxyz0123456789", "github-token"],
            ["xoxb-123456789012-abcdefghijkl", "slack-token"],
            ["AIzaSyB1234567890abcdefghijklmnopqrstuv", "google-api-key"],
            ["sk_live_abcdefghijklmnop1234", "stripe-key"],
        ];

        for (const [value, id] of cases) {
            const findings = scan(`voici la valeur ${value} à ne pas partager`);
            expect(findings.map((finding) => finding.id)).toContain(id);
        }
    });

    it("repère une clé privée et un jeton JWT", () => {
        expect(hasSecret("-----BEGIN RSA PRIVATE KEY-----")).toBe(true);
        expect(
            hasSecret("eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U")
        ).toBe(true);
    });

    it("repère une chaîne de connexion contenant un mot de passe", () => {
        const findings = scan("mysql://qweillo:tr3sSecret@db.interne:3306/qweillo");
        expect(findings[0].id).toBe("connection-string");
    });

    it("repère une affectation explicite mais épargne les gabarits", () => {
        expect(hasSecret("password=Tr0ub4dor&3xyz")).toBe(true);
        expect(hasSecret("api_key: 9f8e7d6c5b4a3210ffee")).toBe(true);

        expect(hasSecret("password=<votre mot de passe>")).toBe(false);
        expect(hasSecret("password=changeme")).toBe(false);
        expect(hasSecret("token=${GITHUB_TOKEN}")).toBe(false);
        expect(hasSecret("secret=xxxxxxxxx")).toBe(false);
    });

    it("laisse passer un texte ordinaire", () => {
        expect(scan("la taverne ouvre à 21 h, amenez vos histoires")).toEqual([]);
        expect(scan("j'ai oublié mon mot de passe, tu peux le réinitialiser ?")).toEqual([]);
        expect(scan("")).toEqual([]);
        expect(scan(null)).toEqual([]);
    });

    it("masque la valeur en gardant le message lisible", () => {
        const text = "déploie avec AKIAIOSFODNN7EXAMPLE puis relance";
        const masked = redact(text);

        expect(masked).toBe("déploie avec ‹secret masqué› puis relance");
        expect(masked).not.toContain("AKIAIOSFODNN7EXAMPLE");
    });

    it("masque plusieurs secrets sans décaler les suivants", () => {
        const text = "clé AKIAIOSFODNN7EXAMPLE et jeton ghp_abcdefghijklmnopqrstuvwxyz0123456789 fin";
        const masked = redact(text);

        expect(masked).toBe("clé ‹secret masqué› et jeton ‹secret masqué› fin");
        expect(scan(masked)).toEqual([]);
    });

    it("ne masque qu'une fois un passage capté par deux motifs", () => {
        const findings = scan("token=ghp_abcdefghijklmnopqrstuvwxyz0123456789");
        const overlapping = findings.filter((finding, index) => index > 0 && finding.start < findings[index - 1].end);

        expect(overlapping).toEqual([]);
        expect(redact("token=ghp_abcdefghijklmnopqrstuvwxyz0123456789")).not.toContain("ghp_");
    });

    it("rend des positions exploitables telles quelles", () => {
        const text = "avant AKIAIOSFODNN7EXAMPLE après";
        const [finding] = scan(text);

        expect(text.slice(finding.start, finding.end)).toBe("AKIAIOSFODNN7EXAMPLE");
    });
});
