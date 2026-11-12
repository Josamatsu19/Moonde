export class SignalStore extends EventTarget {
  #state;

  constructor(initialState = {}) {
    super();
    this.#state = new Proxy(structuredClone(initialState), {
      set: (target, prop, value) => {
        const previous = target[prop];
        if (Object.is(previous, value)) return true;
        target[prop] = value;
        this.dispatchEvent(
          new CustomEvent("change", {
            detail: { key: prop, value, previous, state: { ...target } },
          }),
        );
        return true;
      },
    });
  }

  get state() {
    return this.#state;
  }

  setState(partial) {
    for (const [key, value] of Object.entries(partial)) {
      this.#state[key] = value;
    }
  }

  subscribe(callback) {
    const handler = (event) => callback(event.detail);
    this.addEventListener("change", handler);
    return () => this.removeEventListener("change", handler);
  }
}

const getStorageItem = (key, fallback) => {
  try {
    return typeof localStorage !== "undefined"
      ? localStorage.getItem(key) || fallback
      : fallback;
  } catch {
    return fallback;
  }
};

export const appStore = new SignalStore({
  lang: getStorageItem("moondex_lang", "es"),
  theme: getStorageItem("moondex_theme", "dark"),
  online: typeof navigator !== "undefined" ? navigator.onLine : true,
  seededSpeciesCount: 0,
  cacheEntriesCount: 0,
  reducedMotion:
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false,
});
