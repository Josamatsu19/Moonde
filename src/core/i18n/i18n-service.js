import { cacheRepo } from "../storage/cache-repository.js";
import { appStore } from "../state/signal-store.js";

export class I18nService {
  #dictionaries = new Map();
  #officialLanguages = new Map([
    ["es", { id: 7, name: "es", officialName: "Español", iso639: "es" }],
    ["en", { id: 9, name: "en", officialName: "English", iso639: "en" }],
  ]);

  async init() {
    await Promise.all([this.loadDictionary("es"), this.loadDictionary("en")]);
    this.syncOfficialLanguagesFromApi().catch(() => {
      // Mantiene metadatos base si el primer arranque ocurre sin conexión
    });
  }

  async loadDictionary(lang) {
    if (this.#dictionaries.has(lang)) return this.#dictionaries.get(lang);
    const res = await fetch(`/locales/${lang}.json`);
    if (!res.ok)
      throw new Error(`No se pudo cargar el diccionario /locales/${lang}.json`);
    const dict = await res.json();
    this.#dictionaries.set(lang, dict);
    return dict;
  }

  async syncOfficialLanguagesFromApi() {
    const listResult = await cacheRepo.getPaginated("/language/", {
      limit: 20,
      offset: 0,
    });
    const targetLangs = ["es", "en"];

    for (const code of targetLangs) {
      const match = listResult.data?.results?.find(
        (item) => item.name === code,
      );
      if (match) {
        const id = Number(match.url.split("/").filter(Boolean).pop());
        const detail = await cacheRepo.getResource(`/language/${id}/`);
        const localizedSelf = this.pickLocalized(
          detail.data.names,
          code,
          "name",
        );
        this.#officialLanguages.set(code, {
          id: detail.data.id,
          name: detail.data.name,
          officialName: localizedSelf.text || code.toUpperCase(),
          iso639: detail.data.iso639,
        });
      }
    }
  }

  t(key, lang = appStore.state.lang) {
    const activeDict =
      this.#dictionaries.get(lang) || this.#dictionaries.get("es") || {};
    const fallbackDict = this.#dictionaries.get("en") || {};
    return activeDict[key] ?? fallbackDict[key] ?? key;
  }

  setLanguage(lang) {
    const normalized = lang === "en" ? "en" : "es";
    localStorage.setItem("moondex_lang", normalized);
    document.documentElement.lang = normalized;
    appStore.setState({ lang: normalized });
  }

  getLanguageMeta(lang = appStore.state.lang) {
    return (
      this.#officialLanguages.get(lang) || {
        id: 7,
        name: "es",
        officialName: "Español",
      }
    );
  }

  pickLocalized(
    entries = [],
    preferredLang = appStore.state.lang,
    field = "name",
  ) {
    if (!Array.isArray(entries) || entries.length === 0) {
      return { text: "", lang: preferredLang, isFallback: false };
    }

    const clean = (str) =>
      String(str || "")
        .replace(/[\n\f\r]+/g, " ")
        .trim();

    const exact = entries.find(
      (item) => item?.language?.name === preferredLang && item[field],
    );
    if (exact) {
      return {
        text: clean(exact[field]),
        lang: preferredLang,
        isFallback: false,
      };
    }

    const english = entries.find(
      (item) => item?.language?.name === "en" && item[field],
    );
    if (english) {
      return {
        text: clean(english[field]),
        lang: "en",
        isFallback: preferredLang !== "en",
      };
    }

    const firstValid = entries.find((item) => Boolean(item?.[field]));
    return {
      text: clean(firstValid?.[field] || ""),
      lang: firstValid?.language?.name || "unknown",
      isFallback: true,
    };
  }
}

export const i18n = new I18nService();
