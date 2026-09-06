"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { instanceEndpoint, partitionFor, readInstances, rememberInstance } = require("../src/instances.cjs");

test("chaque origine possède sa partition de session", () => {
    assert.notEqual(partitionFor("https://first.example"), partitionFor("https://second.example"));
    assert.equal(partitionFor("https://FIRST.example:443/"), partitionFor("https://first.example"));
    assert.equal(instanceEndpoint("http://localhost:8080"), "http://localhost:8080");
    assert.throws(() => instanceEndpoint("http://192.168.1.10"));
    assert.throws(() => instanceEndpoint("file:///tmp/index.html"));
});

test("l’historique persiste sans conserver une origine invalide", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "qweillo-instances-"));
    try {
        rememberInstance(directory, "https://first.example");
        rememberInstance(directory, "https://second.example");
        rememberInstance(directory, "https://first.example");
        assert.equal(readInstances(directory).active, "https://first.example");
        assert.equal(readInstances(directory).entries.length, 2);
        fs.writeFileSync(
            path.join(directory, "instances.json"),
            JSON.stringify({
                active: "javascript:alert(1)",
                entries: [{ origin: "http://evil.example" }, { origin: "https://safe.example" }],
            })
        );
        assert.equal(readInstances(directory).active, null);
        assert.deepEqual(
            readInstances(directory).entries.map((entry) => entry.origin),
            ["https://safe.example"]
        );
    } finally {
        fs.rmSync(directory, { recursive: true, force: true });
    }
});
