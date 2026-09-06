const KEY = "qweillo.outbox";
const MAX = 50;

const read = () => {
    try {
        const raw = JSON.parse(localStorage.getItem(KEY) || "[]");
        return Array.isArray(raw) ? raw : [];
    } catch {
        return [];
    }
};

const write = (items) => {
    try {
        localStorage.setItem(KEY, JSON.stringify(items.slice(-MAX)));
    } catch {}
};

export function newNonce() {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();

    const hex = (length) => Array.from({ length }, () => Math.floor(Math.random() * 16).toString(16)).join("");
    return `${hex(8)}-${hex(4)}-4${hex(3)}-a${hex(3)}-${Date.now().toString(16).padStart(12, "0").slice(-12)}`;
}

export function enqueue({ channelId, content, replyToId = null }) {
    const entry = {
        id: newNonce(),
        channelId,
        content,
        replyToId,
        queuedAt: Date.now(),
    };
    write([...read(), entry]);
    return entry;
}

export const pending = (channelId = null) =>
    read().filter((entry) => channelId === null || entry.channelId === channelId);

export function remove(id) {
    write(read().filter((entry) => entry.id !== id));
}

export const clear = () => write([]);

export async function flush(send) {
    for (const entry of read()) {
        try {
            await send(entry);
            remove(entry.id);
        } catch (error) {
            if (error?.status >= 400 && error.status < 500) {
                remove(entry.id);
                continue;
            }
            return false;
        }
    }
    return true;
}
