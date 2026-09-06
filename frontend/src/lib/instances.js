const STORAGE_KEY = "qweillo.instances";

export function instanceOrigin(value) {
    if (
        typeof value !== "string" ||
        !value.trim() ||
        value.length > 2048 ||
        [...value].some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)
    )
        throw new Error("Saisissez l’adresse de votre instance.");
    const input = value.trim();
    const local = /^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?\/?$/i.test(input);
    let url;
    try {
        url = new URL(/^https?:\/\//i.test(input) ? input : `${local ? "http" : "https"}://${input}`);
    } catch {
        throw new Error("Cette adresse n’est pas valide.");
    }
    if (url.username || url.password || url.search || url.hash || url.pathname !== "/") {
        throw new Error("Utilisez l’adresse de l’instance, sans identifiants ni chemin supplémentaire.");
    }
    if (url.protocol !== "https:" && !(url.protocol === "http:" && isLocalInstance(url.origin))) {
        throw new Error("Une instance distante doit utiliser HTTPS.");
    }
    return url.origin;
}

export function isLocalInstance(value) {
    try {
        return ["localhost", "127.0.0.1", "[::1]"].includes(new URL(value).hostname);
    } catch {
        return false;
    }
}

export function readInstances() {
    try {
        const values = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
        if (!Array.isArray(values)) return [];
        return values
            .flatMap((entry) => {
                try {
                    return [
                        {
                            origin: instanceOrigin(entry.origin),
                            name: String(entry.name || new URL(entry.origin).host).slice(0, 80),
                        },
                    ];
                } catch {
                    return [];
                }
            })
            .slice(0, 8);
    } catch {
        return [];
    }
}

export function rememberInstance(origin, name) {
    const value = instanceOrigin(origin);
    const entries = [
        { origin: value, name: String(name || new URL(value).host).slice(0, 80) },
        ...readInstances().filter((entry) => entry.origin !== value),
    ].slice(0, 8);
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    } catch {}
    return entries;
}
