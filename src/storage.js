const DB_NAME = "texteditor_db";
const DB_VERSION = 1;
const STORE = "documents";

function openDb() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);

        req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains(STORE)) {
                db.createObjectStore(STORE, { keyPath: "id" });
            }
        };

        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

export async function loadDocument(id = "default") {
    const db = await openDb();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, "readonly");
        const store = tx.objectStore(STORE);
        const req = store.get(id);

        req.onsuccess = () => resolve(req.result ?? null);
        req.onerror = () => reject(req.error);

        tx.oncomplete = () => db.close();
    });
}

export async function loadAllDocuments() {
    const db = await openDb();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, "readonly");
        const store = tx.objectStore(STORE);
        const req = store.getAll();

        req.onsuccess = () => resolve(req.result ?? []);
        req.onerror = () => reject(req.error);

        tx.oncomplete = () => db.close();
    });
}

export async function saveDocument(doc) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, "readwrite");
        const store = tx.objectStore(STORE);
        const req = store.put(doc);

        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);

        tx.oncomplete = () => db.close();
    });
}

export async function deleteDocument(id) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, "readwrite");
        const store = tx.objectStore(STORE);
        const req = store.delete(id);

        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);

        tx.oncomplete = () => db.close();
    });
}