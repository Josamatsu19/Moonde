export class Router {
  #routes = new Map();
  #outlet = null;
  #currentCleanup = null;

  constructor(routes = {}) {
    for (const [path, handler] of Object.entries(routes)) {
      this.#routes.set(path, handler);
    }
  }

  mount(outletElement) {
    this.#outlet = outletElement;

    window.addEventListener("popstate", () => {
      this.resolve(window.location.pathname, { moveFocus: true });
    });

    document.addEventListener("click", (event) => {
      const link = event.target.closest("a[data-nav]");
      if (!link) return;
      const url = new URL(link.href, window.location.origin);
      if (url.origin !== window.location.origin) return;

      event.preventDefault();
      this.navigate(url.pathname);
    });

    this.resolve(window.location.pathname, { moveFocus: false });
  }

  navigate(pathname) {
    if (window.location.pathname !== pathname) {
      window.history.pushState({}, "", pathname);
    }
    this.resolve(pathname, { moveFocus: true });
  }

  async resolve(pathname, { moveFocus = true } = {}) {
    if (!this.#outlet) return;

    if (typeof this.#currentCleanup === "function") {
      this.#currentCleanup();
      this.#currentCleanup = null;
    }

    const handler = this.#routes.get(pathname) || this.#routes.get("/") || null;
    if (handler) {
      this.#currentCleanup = await handler(this.#outlet, pathname);
    }

    document.querySelectorAll("a[data-nav]").forEach((a) => {
      const isCurrent = a.getAttribute("href") === pathname;
      if (isCurrent) {
        a.setAttribute("aria-current", "page");
      } else {
        a.removeAttribute("aria-current");
      }
    });

    if (moveFocus) {
      this.#outlet.focus({ preventScroll: true });
    }
  }
}
