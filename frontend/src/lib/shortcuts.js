export const SHORTCUTS = [
    { id: "palette", label: "Palette de commandes", keys: { mod: true, key: "k" }, hint: "⌘K" },
    { id: "microphone", label: "Micro", keys: { mod: true, shift: true, key: "m" }, hint: "⌘⇧M" },
    { id: "next-unread", label: "Salon suivant non lu", keys: { alt: true, shift: true, key: "arrowdown" }, hint: "Alt ⇧ ↓" },
    { id: "inbox", label: "Boîte de réception", keys: { mod: true, key: "i" }, hint: "⌘I" },
    { id: "reply-last", label: "Répondre au dernier message", keys: { key: "r" }, hint: "R" },
    { id: "mark-read", label: "Marquer le salon comme lu", keys: { key: "escape" }, hint: "Échap" },
];

export function matches(event, keys) {
    const modifier = event.metaKey || event.ctrlKey;
    if (Boolean(keys.mod) !== modifier) return false;
    if (Boolean(keys.shift) !== event.shiftKey) return false;
    if (Boolean(keys.alt) !== event.altKey) return false;
    return String(event.key ?? "").toLowerCase() === keys.key;
}

export function resolve(event, { typing = false, bindings = SHORTCUTS } = {}) {
    for (const shortcut of bindings) {
        const needsModifier = shortcut.keys.mod || shortcut.keys.alt;
        if (typing && !needsModifier) continue;
        if (matches(event, shortcut.keys)) return shortcut;
    }
    return null;
}

export const isTyping = (target) =>
    target instanceof HTMLElement &&
    (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
