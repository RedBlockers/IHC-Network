"use strict";

const request = require("supertest");
const createApp = require("../../src/app");
const { makeUser, authenticateAs } = require("../helpers/auth");
const linkPreviewService = require("../../src/services/linkPreviewService");

describe("Aperçu de lien", () => {
    const alice = makeUser({ userId: 1, handle: "alice" });
    const app = createApp();
    let token;

    beforeEach(() => {
        token = authenticateAs(alice);
    });

    const auth = (call) => call.set("Authorization", token(alice));

    describe("Refus avant toute requête sortante", () => {
        test.each([
            ["http://127.0.0.1/", "bouclage"],
            ["http://169.254.169.254/latest/meta-data/", "métadonnées de l'hébergeur"],
            ["http://10.0.0.1/", "réseau privé"],
            ["file:///etc/passwd", "protocole de fichier"],
            ["http://user:pass@interne/", "identifiants dans l'adresse"],
            ["http://exemple.fr:6379/", "port hors du web"],
            ["http://localhost/", "hôte local"],
        ])("refuse %s (%s)", async (url) => {
            const response = await auth(request(app).get(`/api/v1/links/preview?url=${encodeURIComponent(url)}`));

            expect(response.status).toBe(400);
            expect(response.body.error.message).toMatch(/refusé/i);
        });

        test("exige d'être connecté", async () => {
            await request(app).get("/api/v1/links/preview?url=https://exemple.fr").expect(401);
        });
    });

    describe("Extraction des métadonnées", () => {
        const url = new URL("https://exemple.fr/article");

        test("préfère les balises Open Graph au titre du document", () => {
            const html = `
                <html><head>
                <title>Titre du document</title>
                <meta property="og:title" content="Le vrai titre">
                <meta property="og:description" content="Une description">
                <meta property="og:site_name" content="Exemple">
                </head></html>`;

            const result = linkPreviewService.extract(html, url);

            expect(result.title).toBe("Le vrai titre");
            expect(result.description).toBe("Une description");
            expect(result.site).toBe("Exemple");
        });

        test("retombe sur le titre du document quand rien d'autre n'existe", () => {
            const result = linkPreviewService.extract("<html><head><title>Simple</title></head></html>", url);

            expect(result.title).toBe("Simple");
            expect(result.site).toBe("exemple.fr");
        });

        test("accepte les attributs dans les deux ordres", () => {
            const html = '<meta content="Titre inversé" property="og:title">';
            expect(linkPreviewService.extract(html, url).title).toBe("Titre inversé");
        });

        test("décode les entités", () => {
            const html = '<meta property="og:title" content="Tom &amp; Jerry &quot;le film&quot;">';
            expect(linkPreviewService.extract(html, url).title).toBe('Tom & Jerry "le film"');
        });

        test("ignore une image qui n'est pas une adresse web", () => {
            const html = '<meta property="og:image" content="javascript:alert(1)">';
            expect(linkPreviewService.extract(html, url).image).toBeNull();
        });

        test("borne la longueur des textes", () => {
            const html = `<meta property="og:title" content="${"a".repeat(2000)}">`;
            expect(linkPreviewService.extract(html, url).title.length).toBeLessThanOrEqual(300);
        });

        test("un document vide ne produit pas d'erreur", () => {
            const result = linkPreviewService.extract("", url);

            expect(result.title).toBeNull();
            expect(result.description).toBeNull();
            expect(result.url).toBe("https://exemple.fr/article");
        });
    });
});
