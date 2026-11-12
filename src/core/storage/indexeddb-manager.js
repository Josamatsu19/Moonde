export const DB_NAME = "moondex_local_v1";
export const DB_VERSION = 1;
export const CACHE_SCHEMA_VERSION = 1;

export const STORES = {
  API_CACHE: "api_cache",
  CATALOG_INDEX: "catalog_index",
  FAVORITES: "favorites",
  TEAMS: "teams",
  COLLECTIONS: "collections",
  BATTLE_LOGS: "battle_logs",
  SYNC_OUTBOX: "sync_outbox",
  TELEMETRY_BUFFER: "telemetry_buffer",
};

export class IndexedDBManager {
  #dbPromise = null;
  #memoryFallback = new Map();
  #usingFallback = false;

  constructor() {
    for (const storeName of Object.values(STORES)) {
      this.#memoryFallback.set(storeName, new Map());
    }
  }

  async open() {
    if (this.#dbPromise) return this.#dbPromise;

    if (typeof indexedDB === "undefined") {
      this.#usingFallback = true;
      return null;
    }

    this.#dbPromise = new Promise((resolve) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        if (!db.objectStoreNames.contains(STORES.API_CACHE)) {
          const cacheStore = db.createObjectStore(STORES.API_CACHE, {
            keyPath: "cacheKey",
          });
          cacheStore.createIndex("endpoint", "endpoint", { unique: false });
          cacheStore.createIndex("expiresAt", "expiresAt", { unique: false });
          cacheStore.createIndex("schemaVersion", "schemaVersion", {
            unique: false,
          });
        }

        if (!db.objectStoreNames.contains(STORES.CATALOG_INDEX)) {
          const catalogStore = db.createObjectStore(STORES.CATALOG_INDEX, {
            keyPath: "id",
          });
          catalogStore.createIndex("slug", "slug", { unique: true });
          catalogStore.createIndex("generationId", "generationId", {
            unique: false,
          });
          catalogStore.createIndex("color", "color", { unique: false });
          catalogStore.createIndex("shape", "shape", { unique: false });
          catalogStore.createIndex("habitat", "habitat", { unique: false });
          catalogStore.createIndex("types", "types", {
            unique: false,
            multiEntry: true,
          });
        }

        if (!db.objectStoreNames.contains(STORES.FAVORITES)) {
          const favStore = db.createObjectStore(STORES.FAVORITES, {
            keyPath: "speciesId",
          });
          favStore.createIndex("addedAt", "addedAt", { unique: false });
        }

        if (!db.objectStoreNames.contains(STORES.TEAMS)) {
          const teamStore = db.createObjectStore(STORES.TEAMS, {
            keyPath: "teamId",
          });
          teamStore.createIndex("updatedAt", "updatedAt", { unique: false });
        }

        if (!db.objectStoreNames.contains(STORES.COLLECTIONS)) {
          const colStore = db.createObjectStore(STORES.COLLECTIONS, {
            keyPath: "collectionId",
          });
          colStore.createIndex("updatedAt", "updatedAt", { unique: false });
        }

        if (!db.objectStoreNames.contains(STORES.BATTLE_LOGS)) {
          const logStore = db.createObjectStore(STORES.BATTLE_LOGS, {
            keyPath: "battleId",
          });
          logStore.createIndex("createdAt", "createdAt", { unique: false });
        }

        if (!db.objectStoreNames.contains(STORES.SYNC_OUTBOX)) {
          const syncStore = db.createObjectStore(STORES.SYNC_OUTBOX, {
            keyPath: "mutationId",
          });
          syncStore.createIndex("createdAt", "createdAt", { unique: false });
        }

        if (!db.objectStoreNames.contains(STORES.TELEMETRY_BUFFER)) {
          const telStore = db.createObjectStore(STORES.TELEMETRY_BUFFER, {
            keyPath: "eventId",
          });
          telStore.createIndex("timestamp", "timestamp", { unique: false });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        this.#usingFallback = true;
        resolve(null);
      };
    });

    return this.#dbPromise;
  }

  async get(storeName, key) {
    const db = await this.open();
    if (!db || this.#usingFallback) {
      return this.#memoryFallback.get(storeName)?.get(key) ?? null;
    }

    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readonly");
      const req = tx.objectStore(storeName).get(key);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
  }

  async put(storeName, value) {
    const db = await this.open();
    if (!db || this.#usingFallback) {
      const keyField = this.#resolveKeyField(storeName);
      this.#memoryFallback
        .get(storeName)
        ?.set(value[keyField], structuredClone(value));
      return value;
    }

    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readwrite");
      tx.objectStore(storeName).put(value);
      tx.oncomplete = () => resolve(value);
      tx.onerror = () => reject(tx.error);
    });
  }

  async bulkPut(storeName, items = []) {
    const db = await this.open();
    if (!db || this.#usingFallback) {
      const keyField = this.#resolveKeyField(storeName);
      const map = this.#memoryFallback.get(storeName);
      for (const item of items) map.set(item[keyField], structuredClone(item));
      return items.length;
    }

    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readwrite");
      const store = tx.objectStore(storeName);
      for (const item of items) {
        store.put(item);
      }
      tx.oncomplete = () => resolve(items.length);
      tx.onerror = () => reject(tx.error);
    });
  }

  async getAll(storeName) {
    const db = await this.open();
    if (!db || this.#usingFallback) {
      return Array.from(this.#memoryFallback.get(storeName)?.values() || []);
    }

    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readonly");
      const req = tx.objectStore(storeName).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async count(storeName) {
    const db = await this.open();
    if (!db || this.#usingFallback) {
      return this.#memoryFallback.get(storeName)?.size ?? 0;
    }

    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readonly");
      const req = tx.objectStore(storeName).count();
      req.onsuccess = () => resolve(req.result || 0);
      req.onerror = () => reject(req.error);
    });
  }

  async hydrateSeedIfNeeded(seedUrl = "/data/seed-index.min.json") {
    const existingCount = await this.count(STORES.CATALOG_INDEX);
    if (existingCount > 0) return existingCount;

    const response = await fetch(seedUrl);
    if (!response.ok) return 0;
    const payload = await response.json();
    if (Array.isArray(payload.entries) && payload.entries.length > 0) {
      await this.bulkPut(STORES.CATALOG_INDEX, payload.entries);
      return payload.entries.length;
    }
    return 0;
  }

  #resolveKeyField(storeName) {
    const keys = {
      [STORES.API_CACHE]: "cacheKey",
      [STORES.CATALOG_INDEX]: "id",
      [STORES.FAVORITES]: "speciesId",
      [STORES.TEAMS]: "teamId",
      [STORES.COLLECTIONS]: "collectionId",
      [STORES.BATTLE_LOGS]: "battleId",
      [STORES.SYNC_OUTBOX]: "mutationId",
      [STORES.TELEMETRY_BUFFER]: "eventId",
    };
    return keys[storeName] || "id";
  }
}

export const dbManager = new IndexedDBManager();
