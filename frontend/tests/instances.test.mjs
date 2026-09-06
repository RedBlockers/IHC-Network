import test from "node:test";
import assert from "node:assert/strict";
import { instanceOrigin, isLocalInstance, readInstances, rememberInstance } from "../src/lib/instances.js";

test("normalise les domaines et permet une instance locale sans TLS", () => {
    assert.equal(instanceOrigin(" communaute.example "), "https://communaute.example");
    assert.equal(instanceOrigin("HTTPS://COMMUNAUTE.EXAMPLE:443/"), "https://communaute.example");
    assert.equal(instanceOrigin("localhost:8080"), "http://localhost:8080");
    assert.equal(instanceOrigin("http://127.0.0.1:8080/"), "http://127.0.0.1:8080");
    assert.equal(isLocalInstance("https://localhost.attacker.example"), false);
});

test("une adresse d’instance ne transporte ni code, ni identifiants, ni paramètres", () => {
    for (const value of [
        "javascript:alert(1)",
        "data:text/html,test",
        "file:///etc/passwd",
        "http://192.168.1.4",
        "http://example.org",
        "https://user:secret@example.org",
        "https://example.org/login",
        "https://example.org?token=private",
        "https://example.org/#token",
        "https://exam\nple.org",
        "",
    ]) {
        assert.throws(() => instanceOrigin(value), value);
    }
});

test("les instances enregistrées sont validées, dédupliquées et bornées", () => {
    let content = JSON.stringify([
        { origin: "javascript:alert(1)" },
        { origin: "https://old.example", name: "Ancienne" },
    ]);
    globalThis.localStorage = {
        getItem: () => content,
        setItem: (_key, value) => {
            content = value;
        },
    };
    try {
        assert.equal(readInstances().length, 1);
        for (let i = 0; i < 12; i++) rememberInstance(`https://instance${i}.example`);
        assert.equal(readInstances().length, 8);
        rememberInstance("https://instance11.example", "Mon instance");
        assert.equal(readInstances().length, 8);
        assert.equal(readInstances()[0].name, "Mon instance");
    } finally {
        delete globalThis.localStorage;
    }
});
