let listener = null;

export function connectComposer(insert) {
    listener = insert;
    return () => {
        if (listener === insert) listener = null;
    };
}

export function insertIntoComposer(text) {
    if (!listener) return false;
    listener(String(text ?? ""));
    return true;
}
