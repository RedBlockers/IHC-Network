const listeners = new Set();
let current = "";

export function announce(message) {
    const text = String(message ?? "").trim();
    if (!text) return;

    current = current === text ? "" : current;
    emit();

    current = text;
    emit();
}

function emit() {
    for (const listener of listeners) listener(current);
}

export function subscribe(listener) {
    listeners.add(listener);
    listener(current);
    return () => listeners.delete(listener);
}

export function reset() {
    current = "";
    emit();
}
