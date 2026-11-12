import "fake-indexeddb/auto";
import { describe, it, expect } from "vitest";
import { FetchScheduler } from "../../src/core/http/fetch-scheduler.js";
import {
  IndexedDBManager,
  STORES,
} from "../../src/core/storage/indexeddb-manager.js";
import { CacheRepository } from "../../src/core/storage/cache-repository.js";
import { I18nService } from "../../src/core/i18n/i18n-service.js";

describe("Sprint 1 — Fundaciones Local-First, FetchScheduler e I18n", () => {
  it("FetchScheduler nunca supera el límite de 4 peticiones concurrentes y deduplica URLs idénticas en vuelo", async () => {
    let inFlight = 0;
    let maxObservedConcurrency = 0;
    let networkCalls = 0;

    const mockFetch = async (url) => {
      inFlight += 1;
      networkCalls += 1;
      maxObservedConcurrency = Math.max(maxObservedConcurrency, inFlight);
      await new Promise((r) => setTimeout(r, 40));
      inFlight -= 1;
      return {
        ok: true,
        status: 200,
        json: async () => ({ url }),
      };
    };

    const scheduler = new FetchScheduler({
      maxConcurrency: 4,
      minSpacingMs: 5,
      fetchImpl: mockFetch,
    });

    const [dupA, dupB] = await Promise.all([
      scheduler.schedule("https://pokeapi.co/api/v2/pokemon/25"),
      scheduler.schedule("https://pokeapi.co/api/v2/pokemon/25"),
    ]);
    expect(dupA.url).toBe(dupB.url);
    expect(networkCalls).toBe(1);

    const urls = Array.from(
      { length: 12 },
      (_, i) => `https://pokeapi.co/api/v2/pokemon/${i + 1}`,
    );
    await Promise.all(urls.map((u) => scheduler.schedule(u)));

    expect(maxObservedConcurrency).toBeLessThanOrEqual(4);
  });

  it("CacheRepository guarda en IndexedDB (L2) y sirve desde caché sin llamar de nuevo a la red", async () => {
    let fetchCount = 0;
    const scheduler = new FetchScheduler({
      minSpacingMs: 1,
      fetchImpl: async () => {
        fetchCount += 1;
        return {
          ok: true,
          status: 200,
          json: async () => ({ id: 7, name: "es" }),
        };
      },
    });

    const db = new IndexedDBManager();
    const repo = new CacheRepository({ db, scheduler });

    const firstCall = await repo.getResource("/language/7/");
    expect(firstCall.source).toBe("network-pokeapi");
    expect(fetchCount).toBe(1);

    const secondRepo = new CacheRepository({ db, scheduler });
    const secondCall = await secondRepo.getResource("/language/7/");
    expect(secondCall.source).toBe("indexeddb-l2");
    expect(secondCall.data.name).toBe("es");
    expect(fetchCount).toBe(1);

    const totalCached = await db.count(STORES.API_CACHE);
    expect(totalCached).toBeGreaterThanOrEqual(1);
  });

  it("I18nService.pickLocalized devuelve español cuando existe y aplica fallback a inglés con bandera isFallback", () => {
    const service = new I18nService();

    const fullEntries = [
      { language: { name: "en" }, flavor_text: "Electric mouse\nPokémon." },
      { language: { name: "es" }, flavor_text: "Pokémon ratón\feléctrico." },
    ];
    const esResult = service.pickLocalized(fullEntries, "es", "flavor_text");
    expect(esResult).toEqual({
      text: "Pokémon ratón eléctrico.",
      lang: "es",
      isFallback: false,
    });

    const missingSpanishEntries = [
      { language: { name: "en" }, flavor_text: "Only in English." },
    ];
    const fallbackResult = service.pickLocalized(
      missingSpanishEntries,
      "es",
      "flavor_text",
    );
    expect(fallbackResult).toEqual({
      text: "Only in English.",
      lang: "en",
      isFallback: true,
    });
  });
});
