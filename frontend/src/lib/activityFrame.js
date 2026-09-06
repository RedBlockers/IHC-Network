export function activityIframeSrc(origin, token) {
    let parsed;
    try {
        parsed = new URL(origin);
    } catch {
        throw new Error("L'origine de l'activité n'est pas une URL.");
    }
    if (parsed.protocol !== "https:") {
        throw new Error("Une activité ne s'ouvre qu'en HTTPS.");
    }
    parsed.hash = `token=${encodeURIComponent(token)}`;
    return parsed.toString();
}

export function activitySandbox() {
    return "allow-scripts allow-forms allow-popups";
}

export function activityReferrerPolicy() {
    return "no-referrer";
}
