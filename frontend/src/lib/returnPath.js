export function safeReturnPath(search) {
    const candidate = new URLSearchParams(search).get("returnTo");
    if (!candidate?.startsWith("/") || candidate.startsWith("//")) return "/";
    try {
        const base = "https://qweillo.invalid";
        const url = new URL(candidate, base);
        return url.origin === base ? `${url.pathname}${url.search}${url.hash}` : "/";
    } catch {
        return "/";
    }
}
