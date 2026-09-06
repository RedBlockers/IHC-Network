const DB_NAME = "qweillo-e2ee";
const DB_VERSION = 1;
const STORE = "identity";
const RECORD_KEY = "device";

function openDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = () => {
            if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE);
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function withStore(mode, run) {
    const db = await openDatabase();
    try {
        return await new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE, mode);
            const request = run(transaction.objectStore(STORE));
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    } finally {
        db.close();
    }
}

export const isSupported = () => typeof indexedDB !== "undefined" && Boolean(globalThis.crypto?.subtle);

export async function loadIdentity() {
    if (!isSupported()) return null;
    try {
        return (await withStore("readonly", (store) => store.get(RECORD_KEY))) ?? null;
    } catch {
        return null;
    }
}

export async function saveIdentity(record) {
    await withStore("readwrite", (store) => store.put(record, RECORD_KEY));
    return record;
}

export async function clearIdentity() {
    if (!isSupported()) return;
    await withStore("readwrite", (store) => store.delete(RECORD_KEY));
}
