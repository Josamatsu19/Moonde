export class FetchScheduler {
  #maxConcurrency;
  #minSpacingMs;
  #maxRetries;
  #activeCount = 0;
  #lastDispatchTime = 0;
  #queue = [];
  #inFlight = new Map();
  #fetchImpl;

  constructor({
    maxConcurrency = 4,
    minSpacingMs = 50,
    maxRetries = 2,
    fetchImpl = (...args) => fetch(...args),
  } = {}) {
    this.#maxConcurrency = maxConcurrency;
    this.#minSpacingMs = minSpacingMs;
    this.#maxRetries = maxRetries;
    this.#fetchImpl = fetchImpl;
  }

  get activeCount() {
    return this.#activeCount;
  }

  get pendingCount() {
    return this.#queue.length;
  }

  static buildPaginatedUrl(baseUrl, endpoint, { limit = 20, offset = 0 } = {}) {
    const cleanBase = baseUrl.replace(/\/+$/, "");
    const cleanPath = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
    const url = new URL(`${cleanBase}${cleanPath}`);
    url.searchParams.set("limit", String(limit));
    url.searchParams.set("offset", String(offset));
    return url.toString();
  }

  schedule(url, options = {}) {
    const coalesceKey = `${options.method || "GET"}:${url}`;
    if (this.#inFlight.has(coalesceKey)) {
      return this.#inFlight.get(coalesceKey);
    }

    const taskPromise = new Promise((resolve, reject) => {
      this.#queue.push({ url, options, resolve, reject, coalesceKey });
      this.#drainQueue();
    }).finally(() => {
      this.#inFlight.delete(coalesceKey);
    });

    this.#inFlight.set(coalesceKey, taskPromise);
    return taskPromise;
  }

  #drainQueue() {
    while (this.#activeCount < this.#maxConcurrency && this.#queue.length > 0) {
      const task = this.#queue.shift();
      this.#activeCount += 1;

      const now = Date.now();
      const waitMs = Math.max(
        0,
        this.#lastDispatchTime + this.#minSpacingMs - now,
      );
      this.#lastDispatchTime = now + waitMs;

      setTimeout(async () => {
        try {
          const data = await this.#executeWithRetry(task.url, task.options);
          task.resolve(data);
        } catch (error) {
          task.reject(error);
        } finally {
          this.#activeCount -= 1;
          this.#drainQueue();
        }
      }, waitMs);
    }
  }

  async #executeWithRetry(url, options, attempt = 0) {
    try {
      const response = await this.#fetchImpl(url, {
        ...options,
        headers: {
          Accept: "application/json",
          ...(options.headers || {}),
        },
      });

      if (
        (response.status === 429 || response.status >= 500) &&
        attempt < this.#maxRetries
      ) {
        const backoff =
          Math.pow(2, attempt) * 200 + Math.floor(Math.random() * 80);
        await new Promise((r) => setTimeout(r, backoff));
        return this.#executeWithRetry(url, options, attempt + 1);
      }

      if (!response.ok) {
        throw new Error(`PokeAPI HTTP ${response.status} al consultar ${url}`);
      }

      return await response.json();
    } catch (error) {
      if (attempt < this.#maxRetries) {
        const backoff = Math.pow(2, attempt) * 200;
        await new Promise((r) => setTimeout(r, backoff));
        return this.#executeWithRetry(url, options, attempt + 1);
      }
      throw error;
    }
  }
}

export const defaultScheduler = new FetchScheduler();
