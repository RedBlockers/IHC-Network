"use strict";

const { inspect, isPublicAddress, allPublic } = require("../../src/domain/urlGuard");

describe("Garde des adresses sortantes", () => {
    describe("Adresses IP", () => {
        test.each([
            ["127.0.0.1", "bouclage"],
            ["127.13.37.1", "bouclage, autre octet"],
            ["10.0.0.5", "privé"],
            ["172.16.0.1", "privé"],
            ["172.31.255.254", "privé, haut de plage"],
            ["192.168.1.1", "privé"],
            ["169.254.169.254", "service de métadonnées de l'hébergeur"],
            ["0.0.0.0", "cet hôte"],
            ["100.64.0.1", "partagé opérateur"],
            ["224.0.0.1", "multidiffusion"],
        ])("%s est refusée (%s)", (address) => {
            expect(isPublicAddress(address)).toBe(false);
        });

        test.each([["1.1.1.1"], ["8.8.8.8"], ["172.32.0.1"], ["192.169.0.1"], ["93.184.216.34"]])(
            "%s est acceptée",
            (address) => {
                expect(isPublicAddress(address)).toBe(true);
            }
        );

        test("les bornes de plage sont exactes", () => {
            expect(isPublicAddress("172.15.255.255")).toBe(true);
            expect(isPublicAddress("172.16.0.0")).toBe(false);
            expect(isPublicAddress("172.31.255.255")).toBe(false);
            expect(isPublicAddress("172.32.0.0")).toBe(true);
        });
    });

    describe("IPv6", () => {
        test.each([["::1"], ["::"], ["fc00::1"], ["fd12:3456::1"], ["fe80::1"]])("%s est refusée", (address) => {
            expect(isPublicAddress(address)).toBe(false);
        });

        test("une IPv4 encapsulée retombe sur les règles v4", () => {
            expect(isPublicAddress("::ffff:127.0.0.1")).toBe(false);
            expect(isPublicAddress("::ffff:8.8.8.8")).toBe(true);
        });

        test("une adresse publique passe", () => {
            expect(isPublicAddress("2606:4700::1111")).toBe(true);
        });
    });

    test("ce qui n'est pas une adresse est refusé", () => {
        expect(isPublicAddress("pas-une-adresse")).toBe(false);
        expect(isPublicAddress("")).toBe(false);
    });

    describe("Inspection d'une URL", () => {
        test("accepte une adresse web ordinaire", () => {
            expect(inspect("https://exemple.fr/page").ok).toBe(true);
        });

        test.each([
            ["file:///etc/passwd", "lit le disque"],
            ["gopher://interne:70/", "parle à des services internes"],
            ["ftp://exemple.fr/", "hors du web"],
            ["javascript:alert(1)", "pas une ressource"],
        ])("refuse %s (%s)", (url) => {
            expect(inspect(url).ok).toBe(false);
        });

        test("refuse des identifiants dans l'adresse", () => {
            expect(inspect("http://user:motdepasse@interne/").ok).toBe(false);
        });

        test("refuse un port qui n'est pas celui du web", () => {
            expect(inspect("http://exemple.fr:25/").ok).toBe(false);
            expect(inspect("http://exemple.fr:6379/").ok).toBe(false);
            expect(inspect("http://exemple.fr:8080/").ok).toBe(true);
        });

        test("refuse une adresse interne écrite en clair", () => {
            expect(inspect("http://127.0.0.1/").ok).toBe(false);
            expect(inspect("http://169.254.169.254/latest/meta-data/").ok).toBe(false);
        });

        test("refuse localhost sous toutes ses formes", () => {
            expect(inspect("http://localhost/").ok).toBe(false);
            expect(inspect("http://LOCALHOST/").ok).toBe(false);
            expect(inspect("http://interne.localhost/").ok).toBe(false);
        });

        test("refuse une adresse illisible", () => {
            expect(inspect("pas une adresse").ok).toBe(false);
            expect(inspect(null).ok).toBe(false);
        });
    });

    describe("Résolution de nom", () => {
        test("exige que toutes les adresses soient publiques", () => {
            expect(allPublic([{ address: "1.1.1.1" }, { address: "127.0.0.1" }])).toBe(false);
            expect(allPublic([{ address: "1.1.1.1" }, { address: "8.8.8.8" }])).toBe(true);
        });

        test("un nom sans adresse est refusé", () => {
            expect(allPublic([])).toBe(false);
        });
    });
});
