import { appStore } from "../core/state/signal-store.js";
import { i18n } from "../core/i18n/i18n-service.js";
import { dbManager, STORES } from "../core/storage/indexeddb-manager.js";
import { cacheRepo } from "../core/storage/cache-repository.js";

export class AppShell {
  #root;
  #router;
  #probeResult = null;

  constructor(rootElement, router) {
    this.#root = rootElement;
    this.#router = router;
  }

  async init() {
    this.#bindNetworkListeners();
    this.renderShell();
    appStore.subscribe(() => this.renderShell());
  }

  #bindNetworkListeners() {
    window.addEventListener("online", () =>
      appStore.setState({ online: true }),
    );
    window.addEventListener("offline", () =>
      appStore.setState({ online: false }),
    );
  }

  renderShell() {
    const { lang, theme, online } = appStore.state;
    document.documentElement.setAttribute("data-theme", theme);

    this.#root.innerHTML = `
      <a href="#main-content" class="skip-link">${i18n.t("app.skipToContent")}</a>
      <div class="app-shell">
        <header class="app-header" role="banner">
          <a href="/" data-nav class="brand-title">
            <span class="brand-lens" aria-hidden="true"></span>
            <span>MOONDEX</span>
          </a>

          <nav aria-label="Principal">
            <ul class="nav-list">
              <li><a href="/" data-nav class="nav-link">${i18n.t("nav.diagnostics")}</a></li>
              <li><a href="/catalog" data-nav class="nav-link">${i18n.t("nav.catalog")}</a></li>
              <li><a href="/evolutions" data-nav class="nav-link">${i18n.t("nav.evolutions")}</a></li>
              <li><a href="/battle-lab" data-nav class="nav-link">${i18n.t("nav.battleLab")}</a></li>
              <li><a href="/inventory" data-nav class="nav-link">${i18n.t("nav.inventory")}</a></li>
              <li><a href="/atlas" data-nav class="nav-link">${i18n.t("nav.atlas")}</a></li>
              <li><a href="/history" data-nav class="nav-link">${i18n.t("nav.history")}</a></li>
            </ul>
          </nav>

          <div class="toolbar-controls">
            <div class="status-pill" data-offline="${!online}" role="status" aria-live="polite">
              <span class="status-dot" aria-hidden="true"></span>
              <span>${online ? i18n.t("status.online") : i18n.t("status.offline")}</span>
            </div>

            <label for="lang-select" class="sr-only">${i18n.t("lang.label")}</label>
            <select id="lang-select" class="btn" aria-label="${i18n.t("lang.label")}">
              <option value="es" ${lang === "es" ? "selected" : ""}>ES (Español)</option>
              <option value="en" ${lang === "en" ? "selected" : ""}>EN (English)</option>
            </select>

            <button type="button" class="btn" id="theme-toggle-btn" aria-label="${i18n.t("theme.toggle")}">
              ${theme === "dark" ? "☀️" : "🌙"}
            </button>
          </div>
        </header>

        <main id="main-content" class="app-main" tabindex="-1"></main>

        <footer class="app-footer" role="contentinfo">
          <p>${i18n.t("legal.disclaimer")}</p>
          <button type="button" class="btn" id="open-legal-modal-btn">
            ${i18n.t("s1.legalButton")}
          </button>
        </footer>
      </div>

      <div class="modal-backdrop" id="legal-modal" hidden role="dialog" aria-modal="true" aria-labelledby="legal-modal-title">
        <div class="modal-dialog">
          <h2 id="legal-modal-title">${i18n.t("legal.title")}</h2>
          <p>${i18n.t("legal.disclaimer")}</p>
          <p>${i18n.t("legal.fairUse")}</p>
          <div>
            <button type="button" class="btn btn-primary" id="close-legal-modal-btn">
              ${i18n.t("legal.close")}
            </button>
          </div>
        </div>
      </div>
    `;

    this.#attachShellEvents();
    const outlet = this.#root.querySelector("#main-content");
    this.#router.mount(outlet);
  }

  #attachShellEvents() {
    const langSelect = this.#root.querySelector("#lang-select");
    langSelect?.addEventListener("change", (e) => {
      i18n.setLanguage(e.target.value);
    });

    const themeBtn = this.#root.querySelector("#theme-toggle-btn");
    themeBtn?.addEventListener("click", () => {
      const nextTheme = appStore.state.theme === "dark" ? "light" : "dark";
      localStorage.setItem("moondex_theme", nextTheme);
      appStore.setState({ theme: nextTheme });
    });

    const modal = this.#root.querySelector("#legal-modal");
    const openLegalBtn = this.#root.querySelector("#open-legal-modal-btn");
    const closeLegalBtn = this.#root.querySelector("#close-legal-modal-btn");

    openLegalBtn?.addEventListener("click", () => {
      modal.hidden = false;
      closeLegalBtn?.focus();
    });

    closeLegalBtn?.addEventListener("click", () => {
      modal.hidden = true;
      openLegalBtn?.focus();
    });

    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && modal && !modal.hidden) {
        modal.hidden = true;
        openLegalBtn?.focus();
      }
    });
  }

  async renderDiagnosticsView(outlet, pathname = "/") {
    const seededItems = await dbManager.getAll(STORES.CATALOG_INDEX);
    const cacheCount = await dbManager.count(STORES.API_CACHE);
    const langMeta = i18n.getLanguageMeta();
    const { lang, reducedMotion } = appStore.state;

    outlet.innerHTML = `
      <section class="card-panel" aria-labelledby="s1-heading">
        <p class="mono">ROUTE: ${pathname}</p>
        <h1 id="s1-heading">${i18n.t("s1.heroTitle")}</h1>
        <p>${i18n.t("s1.heroSubtitle")}</p>

        <div class="metrics-grid">
          <article class="card-panel">
            <h2>${i18n.t("s1.seededCount")}</h2>
            <p class="metric-value">${seededItems.length}</p>
          </article>
          <article class="card-panel">
            <h2>${i18n.t("s1.cacheEntries")}</h2>
            <p class="metric-value" id="metric-cache-count">${cacheCount}</p>
          </article>
          <article class="card-panel">
            <h2>${i18n.t("s1.activeLang")}</h2>
            <p class="metric-value">${langMeta.officialName} (#${langMeta.id})</p>
          </article>
          <article class="card-panel">
            <h2>${i18n.t("s1.motionMode")}</h2>
            <p class="metric-value">
              ${reducedMotion ? i18n.t("s1.motionReduced") : i18n.t("s1.motionFull")}
            </p>
          </article>
        </div>

        <div class="toolbar-controls" style="margin-block: 1rem; flex-wrap: wrap;">
          <button type="button" class="btn btn-primary" id="run-probe-btn">
            ${i18n.t("s1.testApiBtn")}
          </button>
          <button type="button" class="btn" id="replay-loader-btn">
            ${i18n.t("s1.replayLoaderBtn")}
          </button>
        </div>

        <div class="card-panel" id="probe-output" aria-live="polite">
          <h3>${i18n.t("s1.probeTitle")}</h3>
          <p class="mono" id="probe-detail">
            ${
              this.#probeResult
                ? this.#probeResult
                : "Pulsa el botón superior para probar FetchScheduler + CacheRepository (L1/L2) con /pokemon/25 y /pokemon-species/25."
            }
          </p>
        </div>

        <div class="seed-grid" aria-label="Semilla estática en IndexedDB">
          ${seededItems
            .map(
              (item) => `
              <article class="seed-card">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                  <span class="mono">#${String(item.id).padStart(4, "0")}</span>
                  <span class="mono">Gen ${item.generationId}</span>
                </div>
                <h3>${item.names[lang] || item.names.en}</h3>
                <p class="mono">Types: ${item.types.join(" / ").toUpperCase()}</p>
                <p class="mono">BST: ${item.baseStats.bst} (SPE ${item.baseStats.spe})</p>
              </article>
            `,
            )
            .join("")}
        </div>
      </section>
    `;

    outlet
      .querySelector("#run-probe-btn")
      ?.addEventListener("click", async () => {
        const detailNode = outlet.querySelector("#probe-detail");
        detailNode.textContent = "Consultando PokeAPI vía FetchScheduler...";
        try {
          const t0 = performance.now();
          const [pokemonRes, speciesRes] = await Promise.all([
            cacheRepo.getResource("/pokemon/25/"),
            cacheRepo.getResource("/pokemon-species/25/"),
          ]);
          const elapsed = (performance.now() - t0).toFixed(1);
          const flavor = i18n.pickLocalized(
            speciesRes.data.flavor_text_entries,
            appStore.state.lang,
            "flavor_text",
          );

          this.#probeResult = `[${pokemonRes.source.toUpperCase()} en ${elapsed} ms] #${pokemonRes.data.id} ${pokemonRes.data.name.toUpperCase()} — "${flavor.text}" ${flavor.isFallback ? "[EN Fallback]" : ""}`;
          detailNode.textContent = this.#probeResult;

          const updatedCount = await dbManager.count(STORES.API_CACHE);
          const countNode = outlet.querySelector("#metric-cache-count");
          if (countNode) countNode.textContent = String(updatedCount);
        } catch (err) {
          detailNode.textContent = `Estado Offline / Error: ${err.message}`;
        }
      });

    outlet
      .querySelector("#replay-loader-btn")
      ?.addEventListener("click", () => {
        const loader = document.querySelector("#boot-loader");
        loader?.playBootSequence();
      });
  }
}
