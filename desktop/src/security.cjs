"use strict";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);
const MEDIA_PERMISSIONS = new Set(["media", "display-capture", "notifications", "fullscreen"]);

function parseEndpoint(configuredUrl) {
    if (
        typeof configuredUrl !== "string" ||
        configuredUrl.trim() === "" ||
        configuredUrl.length > 2048 ||
        /[\u0000-\u001f\u007f]/.test(configuredUrl)
    ) {
        throw new Error("QWEILLO_PUBLIC_URL est requis pour construire l'application.");
    }

    let url;
    try {
        url = new URL(configuredUrl);
    } catch {
        throw new Error("QWEILLO_PUBLIC_URL doit être une URL absolue valide.");
    }

    if (url.username || url.password) {
        throw new Error("L'URL publique ne doit pas contenir d'identifiants.");
    }
    if (url.search || url.hash || !["", "/"].includes(url.pathname)) {
        throw new Error("L'URL publique doit désigner uniquement l'origine qweillo.");
    }
    return url;
}

function resolveEndpoint({ configuredUrl, isPackaged }) {
    const url = parseEndpoint(configuredUrl);
    const localDevelopment = !isPackaged && url.protocol === "http:" && LOCAL_HOSTS.has(url.hostname);
    if (url.protocol !== "https:" && !localDevelopment) {
        throw new Error("La distribution qweillo exige un endpoint HTTPS.");
    }
    return url.origin;
}

function isTrustedNavigation(candidate, endpoint) {
    try {
        const url = new URL(candidate);
        return ["http:", "https:"].includes(url.protocol) && url.origin === new URL(endpoint).origin;
    } catch {
        return false;
    }
}

function isPermissionAllowed(permission, requestingUrl, endpoint) {
    return MEDIA_PERMISSIONS.has(permission) && isTrustedNavigation(requestingUrl, endpoint);
}

function isDisplayRequestAllowed(request, endpoint) {
    return (
        request.userGesture === true &&
        request.videoRequested === true &&
        isTrustedNavigation(request.securityOrigin, endpoint)
    );
}

module.exports = { resolveEndpoint, isTrustedNavigation, isPermissionAllowed, isDisplayRequestAllowed };
