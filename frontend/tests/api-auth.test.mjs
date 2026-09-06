import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { api, tokenStore, onUnauthorized } from "../src/lib/api.js";

const failure = (details) =>
    new Response(JSON.stringify({ error: { code: "unauthorized", message: "Vérification refusée.", details } }), {
        status: 401,
    });
const success = (body) => new Response(JSON.stringify(body), { status: 200 });
afterEach(() => tokenStore.clear());

test("un mot de passe de confirmation incorrect conserve la session", async (context) => {
    const calls = [];
    context.mock.method(globalThis, "fetch", async (url) => {
        calls.push(url);
        return failure();
    });
    tokenStore.set("current-token");
    await assert.rejects(api("/auth/password", { method: "POST", body: { currentPassword: "incorrect" } }), {
        status: 401,
    });
    assert.equal(calls.length, 1);
    assert.equal(tokenStore.get(), "current-token");
});

test("une session expirée est renouvelée avant de rejouer la requête", async (context) => {
    const responses = [failure({ sessionExpired: true }), success({ token: "renewed-token" }), success({ guilds: [] })];
    const calls = [];
    context.mock.method(globalThis, "fetch", async (url) => {
        calls.push(url);
        return responses.shift();
    });
    assert.deepEqual(await api("/guilds"), { guilds: [] });
    assert.deepEqual(calls, ["/api/v1/guilds", "/api/v1/auth/refresh", "/api/v1/guilds"]);
    assert.equal(tokenStore.get(), "renewed-token");
});

test("une erreur métier après renouvellement ne déconnecte pas le compte", async (context) => {
    const responses = [failure({ sessionExpired: true }), success({ token: "renewed-token" }), failure()];
    context.mock.method(globalThis, "fetch", async () => responses.shift());
    await assert.rejects(api("/auth/2fa/confirm", { method: "POST", body: { code: "invalid" } }), { status: 401 });
    assert.equal(tokenStore.get(), "renewed-token");
});

test("un renouvellement refusé ferme la session locale", async (context) => {
    const responses = [failure({ sessionExpired: true }), failure()];
    context.mock.method(globalThis, "fetch", async () => responses.shift());
    let closed = 0;
    const listener = () => {
        closed++;
    };
    onUnauthorized.addEventListener("unauthorized", listener);
    context.after(() => onUnauthorized.removeEventListener("unauthorized", listener));
    tokenStore.set("expired-token");
    await assert.rejects(api("/guilds"), { status: 401 });
    assert.equal(tokenStore.get(), null);
    assert.equal(closed, 1);
});
