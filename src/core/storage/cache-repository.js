import {
  CACHE_SCHEMA_VERSION,
  STORES,
  dbManager,
} from "./indexeddb-manager.js";
import { FetchScheduler, defaultScheduler } from "../http/fetch-scheduler.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const POKEAPI_BASE = "https://pokeapi.co/api/v2";

export class CacheRepository {
  #db;
  #scheduler;
  #l1Memory = new Map();

  constructor({ db = dbManager, scheduler = defaultScheduler } = {}) {
    this.#db = db;
    this.#scheduler = scheduler;
  }

  async getResource(
    endpoint,
    { ttlMs = 14 * DAY_MS, forceRefresh = false } = {},
  ) {
    const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
    const cacheKey = `v${CACHE_SCHEMA_VERSION}:${cleanEndpoint}`;
    const now = Date.now();

    if (!forceRefresh && this.#l1Memory.has(cacheKey)) {
      const cachedL1 = this.#l1Memory.get(cacheKey);
      if (cachedL1.expiresAt > now) {
        return { data: cachedL1.data, source: "memory-l1" };
      }
    }

    const cachedL2 = await this.#db.get(STORES.API_CACHE, cacheKey);
    const isOffline =
      typeof navigator !== "undefined" && navigator.onLine === false;

    if (
      !forceRefresh &&
      cachedL2 &&
      cachedL2.schemaVersion === CACHE_SCHEMA_VERSION &&
      (cachedL2.expiresAt > now || isOffline)
    ) {
      this.#l1Memory.set(cacheKey, cachedL2);
      return { data: cachedL2.data, source: "indexeddb-l2" };
    }

    if (isOffline) {
      throw new Error(
        `Recurso no disponible en caché offline: ${cleanEndpoint}`,
      );
    }

    const url = `${POKEAPI_BASE}${cleanEndpoint}`;
    const freshData = await this.#scheduler.schedule(url);

    const record = {
      cacheKey,
      endpoint: cleanEndpoint,
      data: freshData,
      fetchedAt: now,
      expiresAt: now + ttlMs,
      schemaVersion: CACHE_SCHEMA_VERSION,
    };

    this.#l1Memory.set(cacheKey, record);
    await this.#db.put(STORES.API_CACHE, record);
    return { data: freshData, source: "network-pokeapi" };
  }

  async getPaginated(
    endpoint,
    { limit = 20, offset = 0, ttlMs = 30 * DAY_MS } = {},
  ) {
    const fullUrl = FetchScheduler.buildPaginatedUrl(POKEAPI_BASE, endpoint, {
      limit,
      offset,
    });
    const relativePath = fullUrl.replace(POKEAPI_BASE, "");
    return this.getResource(relativePath, { ttlMs });
  }
}

export const cacheRepo = new CacheRepository();
