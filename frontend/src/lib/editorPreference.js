const KEY = "qweillo.editor";

const DEFAULTS = { editor: "aucun", root: "" };

export function readEditorPreference() {
    try {
        const raw = JSON.parse(localStorage.getItem(KEY) || "null");
        return raw && typeof raw === "object" ? { ...DEFAULTS, ...raw } : DEFAULTS;
    } catch {
        return DEFAULTS;
    }
}

export function writeEditorPreference(next) {
    try {
        localStorage.setItem(KEY, JSON.stringify({ ...DEFAULTS, ...next }));
    } catch {}
}
