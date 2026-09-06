import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";

const store = new Map();
globalThis.localStorage = {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
};
globalThis.crypto ??= (await import("node:crypto")).webcrypto;

const { clear, enqueue, flush, pending, remove } = await import("../src/lib/outbox.js");

beforeEach(() => clear());

test("un message mis en attente reçoit une marque d'unicité", () => {
    const entry = enqueue({ channelId: 10, content: "bonjour" });

    assert.match(entry.id, /^[0-9a-f-]{36}$/);
    assert.equal(pending(10).length, 1);
});

test("la file se filtre par salon", () => {
    enqueue({ channelId: 10, content: "a" });
    enqueue({ channelId: 20, content: "b" });

    assert.equal(pending(10).length, 1);
    assert.equal(pending().length, 2);
});

test("elle survit à un rechargement", async () => {
    enqueue({ channelId: 10, content: "dans le métro" });

    const again = await import(`../src/lib/outbox.js?reload=${Date.now()}`);
    assert.equal(again.pending(10)[0].content, "dans le métro");
});

test("l'envoi vide la file dans l'ordre", async () => {
    enqueue({ channelId: 10, content: "un" });
    enqueue({ channelId: 10, content: "deux" });

    const sent = [];
    assert.equal(await flush(async (entry) => sent.push(entry.content)), true);
    assert.deepEqual(sent, ["un", "deux"]);
    assert.equal(pending().length, 0);
});

test("un échec réseau arrête la file et garde la suite", async () => {
    enqueue({ channelId: 10, content: "un" });
    enqueue({ channelId: 10, content: "deux" });

    const sent = [];
    const ok = await flush(async (entry) => {
        if (entry.content === "un") { sent.push(entry.content); return; }
        throw Object.assign(new Error("réseau"), { status: 0 });
    });

    assert.equal(ok, false);
    assert.deepEqual(sent, ["un"]);
    assert.equal(pending().length, 1);
});

test("un refus du serveur retire l'entrée au lieu de boucler", async () => {
    enqueue({ channelId: 10, content: "trop long" });

    await flush(async () => {
        throw Object.assign(new Error("trop long"), { status: 400 });
    });

    assert.equal(pending().length, 0);
});

test("une file illisible est jetée plutôt que reconstruite à moitié", async () => {
    localStorage.setItem("qweillo.outbox", "{ ceci n'est pas du JSON");

    const again = await import(`../src/lib/outbox.js?broken=${Date.now()}`);
    assert.deepEqual(again.pending(), []);
});

test("retirer une entrée ne touche pas les autres", () => {
    const first = enqueue({ channelId: 10, content: "a" });
    enqueue({ channelId: 10, content: "b" });

    remove(first.id);
    assert.deepEqual(pending().map((e) => e.content), ["b"]);
});

test("la marque se produit même sans crypto.randomUUID", async () => {
    const original = Object.getOwnPropertyDescriptor(globalThis, "crypto");
    Object.defineProperty(globalThis, "crypto", { value: {}, configurable: true });

    const { newNonce } = await import(`../src/lib/outbox.js?nocrypto=${Date.now()}`);
    const nonce = newNonce();

    assert.match(nonce, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    assert.notEqual(newNonce(), newNonce());

    if (original) Object.defineProperty(globalThis, "crypto", original);
});
