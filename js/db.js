// db.js
// Handles IndexedDB storage for Person and Relationship entities

const DB_NAME = 'FamilyTreeDB';
const DB_VERSION = 2;
const STORE_PERSONS = 'persons';
const STORE_RELATIONS = 'relationships';
const STORE_SETTINGS = 'settings';

export let db = null;

export function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            const tempDb = event.target.result;
            
            if (!tempDb.objectStoreNames.contains(STORE_PERSONS)) {
                tempDb.createObjectStore(STORE_PERSONS, { keyPath: 'id' });
            }
            if (!tempDb.objectStoreNames.contains(STORE_RELATIONS)) {
                // simple auto-incremented ID for relationships, but we might manual set UUIDs
                tempDb.createObjectStore(STORE_RELATIONS, { keyPath: 'id' });
            }
            if (!tempDb.objectStoreNames.contains(STORE_SETTINGS)) {
                tempDb.createObjectStore(STORE_SETTINGS, { keyPath: 'id' });
            }
        };

        request.onsuccess = (event) => {
            db = event.target.result;
            resolve(db);
        };

        request.onerror = (event) => {
            console.error("IndexedDB error:", event.target.errorCode);
            reject(event.target.error);
        };
    });
}

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// --- CRUD for Settings ---
export function getSetting(id) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction([STORE_SETTINGS], 'readonly');
        const store = tx.objectStore(STORE_SETTINGS);
        const req = store.get(id);
        
        req.onsuccess = () => resolve(req.result ? req.result.value : null);
        req.onerror = () => reject(req.error);
    });
}

export function setSetting(id, value) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction([STORE_SETTINGS], 'readwrite');
        const store = tx.objectStore(STORE_SETTINGS);
        const req = store.put({ id, value });
        
        req.onsuccess = () => resolve(value);
        req.onerror = () => reject(req.error);
    });
}

// --- CRUD for Persons ---
export function addPerson(personData) {
    return new Promise((resolve, reject) => {
        const id = generateId();
        const person = { ...personData, id };
        
        const tx = db.transaction([STORE_PERSONS], 'readwrite');
        const store = tx.objectStore(STORE_PERSONS);
        const req = store.add(person);
        
        req.onsuccess = () => resolve(person);
        req.onerror = () => reject(req.error);
    });
}

export function updatePerson(person) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction([STORE_PERSONS], 'readwrite');
        const store = tx.objectStore(STORE_PERSONS);
        const req = store.put(person);
        
        req.onsuccess = () => resolve(person);
        req.onerror = () => reject(req.error);
    });
}

export function deletePerson(id) {
    return new Promise(async (resolve, reject) => {
        // First delete all relationships linked to this person
        const tx = db.transaction([STORE_PERSONS, STORE_RELATIONS], 'readwrite');
        const relStore = tx.objectStore(STORE_RELATIONS);
        const persStore = tx.objectStore(STORE_PERSONS);
        
        // This could be optimized using indexes, but for simplicity we fetch all and filter
        const allRelsReq = relStore.getAll();
        allRelsReq.onsuccess = () => {
            const rels = allRelsReq.result;
            rels.forEach(r => {
                if (r.sourceId === id || r.targetId === id) {
                    relStore.delete(r.id);
                }
            });
            
            // Delete the person
            const req = persStore.delete(id);
            req.onsuccess = () => resolve(true);
            req.onerror = () => reject(req.error);
        };
    });
}

export function getAllPersons() {
    return new Promise((resolve, reject) => {
        const tx = db.transaction([STORE_PERSONS], 'readonly');
        const store = tx.objectStore(STORE_PERSONS);
        const req = store.getAll();
        
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

// --- CRUD for Relationships ---
export function addRelation(sourceId, targetId, type) {
    return new Promise((resolve, reject) => {
        const id = generateId();
        const relation = { id, sourceId, targetId, type };
        
        const tx = db.transaction([STORE_RELATIONS], 'readwrite');
        const store = tx.objectStore(STORE_RELATIONS);
        const req = store.add(relation);
        
        req.onsuccess = () => resolve(relation);
        req.onerror = () => reject(req.error);
    });
}

export function getAllRelations() {
    return new Promise((resolve, reject) => {
        const tx = db.transaction([STORE_RELATIONS], 'readonly');
        const store = tx.objectStore(STORE_RELATIONS);
        const req = store.getAll();
        
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

export function deleteRelation(id) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction([STORE_RELATIONS], 'readwrite');
        const store = tx.objectStore(STORE_RELATIONS);
        const req = store.delete(id);
        
        req.onsuccess = () => resolve(true);
        req.onerror = () => reject(req.error);
    });
}

export function exportData() {
    return Promise.all([getAllPersons(), getAllRelations()]).then(([persons, relations]) => {
        // ALWAYS EXPORT AS FROZEN
        return JSON.stringify({ persons, relations, isFrozen: true });
    });
}

export function importData(jsonData) {
    return new Promise((resolve, reject) => {
        try {
            const data = JSON.parse(jsonData);
            if (!data.persons || !data.relations) throw new Error("Invalid format");

            const tx = db.transaction([STORE_PERSONS, STORE_RELATIONS, STORE_SETTINGS], 'readwrite');
            const pStore = tx.objectStore(STORE_PERSONS);
            const rStore = tx.objectStore(STORE_RELATIONS);
            const sStore = tx.objectStore(STORE_SETTINGS);

            // Clear existing
            pStore.clear();
            rStore.clear();

            data.persons.forEach(p => pStore.add(p));
            data.relations.forEach(r => rStore.add(r));
            
            // ALWAYS IMPORT AS FROZEN
            sStore.put({ id: 'isFrozen', value: true });

            tx.oncomplete = () => resolve(true);
            tx.onerror = () => reject(tx.error);
        } catch(e) {
            reject(e);
        }
    });
}
