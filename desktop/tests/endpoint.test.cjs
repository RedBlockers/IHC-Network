"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { resolveEndpoint, isTrustedNavigation, isPermissionAllowed, isDisplayRequestAllowed } = require("../src/security.cjs");

test("refuse un endpoint non chiffré en distribution", () => {
    assert.throws(
        () => resolveEndpoint({ configuredUrl: "http://203.0.113.10", isPackaged: true }),
        /HTTPS/
    );
});

test("normalise un endpoint HTTPS sans chemin ni identifiants", () => {
    assert.equal(
        resolveEndpoint({ configuredUrl: "https://app.qweillo.fr/", isPackaged: true }),
        "https://app.qweillo.fr"
    );
    assert.throws(
        () => resolveEndpoint({ configuredUrl: "https://user:pass@app.qweillo.fr", isPackaged: true }),
        /identifiants/
    );
});

test("la fenêtre reste enfermée sur l'origine qweillo", () => {
    const endpoint = "https://app.qweillo.fr";
    assert.equal(isTrustedNavigation("https://app.qweillo.fr/invite/abc", endpoint), true);
    assert.equal(isTrustedNavigation("https://app.qweillo.fr.evil.example/", endpoint), false);
    assert.equal(isTrustedNavigation("javascript:alert(1)", endpoint), false);
});

test("micro, caméra et partage d'écran sont limités à l'origine qweillo", () => {
    const endpoint = "https://app.qweillo.fr";
    assert.equal(isPermissionAllowed("media", endpoint, endpoint), true);
    assert.equal(isPermissionAllowed("display-capture", `${endpoint}/voice`, endpoint), true);
    assert.equal(isPermissionAllowed("media", "https://evil.example", endpoint), false);
    assert.equal(isPermissionAllowed("clipboard-read", endpoint, endpoint), false);
});

test("le sélecteur d'écran exige l'origine qweillo et un geste utilisateur", () => {
    const endpoint = "https://app.qweillo.fr";
    expectDisplay({ securityOrigin: endpoint, userGesture: true, videoRequested: true }, endpoint, true);
    expectDisplay({ securityOrigin: endpoint, userGesture: false, videoRequested: true }, endpoint, false);
    expectDisplay({ securityOrigin: "https://evil.example", userGesture: true, videoRequested: true }, endpoint, false);
});

function expectDisplay(request, endpoint, expected) {
    assert.equal(isDisplayRequestAllowed(request, endpoint), expected);
}
