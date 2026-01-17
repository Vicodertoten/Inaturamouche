/**
 * SmartCache - Advanced in-memory cache with Request Coalescing
 * 
 * Features:
 * - TTL and stale-while-revalidate patterns
 * - Request Coalescing to prevent cache stampedes
 * - Automatic eviction with LRU policy
 * - Background revalidation support
 */
export class SmartCache {
  constructor({ max = 100, ttl = 0, staleTtl = 0 } = {}) {
    this.max = max;
    this.ttl = ttl;
    this.staleTtl = staleTtl;
    this.store = new Map();
    this.inFlightRequests = new Map(); // Request Coalescing: track in-flight requests
  }

  _now() {
    return Date.now();
  }

  _buildEntry(value, { ttl = this.ttl, staleTtl = this.staleTtl } = {}) {
    const now = this._now();
    if (!ttl || ttl <= 0) {
      return {
        value,
        freshUntil: null,
        staleUntil: null,
        createdAt: now,
        inFlight: null,
      };
    }
    const freshUntil = now + ttl;
    const staleUntil = staleTtl && staleTtl > 0 ? freshUntil + staleTtl : freshUntil;
    return {
      value,
      freshUntil,
      staleUntil,
      createdAt: now,
      inFlight: null,
    };
  }

  _isExpired(entry, now = this._now()) {
    return Boolean(entry?.staleUntil && entry.staleUntil <= now);
  }

  _isStale(entry, now = this._now()) {
    return Boolean(entry?.freshUntil && entry.freshUntil <= now);
  }

  _touch(key, entry) {
    if (!this.store.has(key)) return;
    this.store.delete(key);
    this.store.set(key, entry);
  }

  getEntry(key) {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (this._isExpired(entry)) {
      this.store.delete(key);
      return null;
    }
    this._touch(key, entry);
    return {
      value: entry.value,
      isStale: this._isStale(entry),
      freshUntil: entry.freshUntil,
      staleUntil: entry.staleUntil,
    };
  }

  get(key, { allowStale = false } = {}) {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (this._isExpired(entry)) {
      this.store.delete(key);
      return undefined;
    }
    const isStale = this._isStale(entry);
    if (isStale && !allowStale) return undefined;
    this._touch(key, entry);
    return entry.value;
  }

  set(key, value, options = {}) {
    const entry = this._buildEntry(value, options);
    if (this.store.has(key)) {
      this.store.delete(key);
    }
    this.store.set(key, entry);
    this._enforceMax();
  }

  delete(key) {
    this.store.delete(key);
    this.inFlightRequests.delete(key); // Clean up in-flight request if exists
  }

  clear() {
    this.store.clear();
    this.inFlightRequests.clear(); // Clear all in-flight requests
  }

  prune() {
    const now = this._now();
    for (const [key, entry] of this.store.entries()) {
      if (this._isExpired(entry, now)) this.store.delete(key);
    }
  }

  _enforceMax() {
    if (!this.max || this.max <= 0) return;
    while (this.store.size > this.max) {
      const oldestKey = this.store.keys().next().value;
      this.store.delete(oldestKey);
    }
  }

  async getOrFetch(
    key,
    fetcher,
    { allowStale = true, background = true, onError, ttl, staleTtl } = {}
  ) {
    const entry = this.store.get(key);
    if (entry && !this._isExpired(entry)) {
      const isStale = this._isStale(entry);
      if (!isStale) {
        this._touch(key, entry);
        return entry.value;
      }
      if (allowStale) {
        if (background) {
          this._revalidate(key, fetcher, { onError, ttl, staleTtl });
          this._touch(key, entry);
          return entry.value;
        }
      }
    }
    return this._fetchWithCoalescing(key, fetcher, { onError, ttl, staleTtl });
  }

  /**
   * Fetches data using Request Coalescing to prevent cache stampedes.
   * 
   * When multiple concurrent requests arrive for the same key:
   * - First request triggers fetcher()
   * - Subsequent requests reuse the first request's promise
   * - All requests resolve with identical result
   * - Prevents redundant backend calls and API overload
   * 
   * @param {string} key - Cache key
   * @param {Function} fetcher - Async function to fetch the value
   * @param {Object} options - Configuration options
   * @returns {Promise} - Promise that resolves with the fetched value
   */
  async _fetchWithCoalescing(key, fetcher, { onError, ttl, staleTtl } = {}) {
    // Request Coalescing: reuse in-flight request if one exists
    if (this.inFlightRequests.has(key)) {
      return this.inFlightRequests.get(key);
    }

    // Create new in-flight promise
    const promise = this._fetchAndSet(key, fetcher, { onError, ttl, staleTtl })
      .finally(() => {
        // Clean up after request completes
        this.inFlightRequests.delete(key);
      });

    // Store the promise for request coalescing
    this.inFlightRequests.set(key, promise);
    return promise;
  }

  async _fetchAndSet(key, fetcher, { onError, ttl, staleTtl } = {}) {
    try {
      const value = await fetcher();
      this.set(key, value, { ttl: ttl ?? this.ttl, staleTtl: staleTtl ?? this.staleTtl });
      return value;
    } catch (err) {
      if (typeof onError === "function") onError(err);
      throw err;
    }
  }

  _revalidate(key, fetcher, { onError, ttl, staleTtl } = {}) {
    const entry = this.store.get(key);
    if (!entry) return;
    if (entry.inFlight) return;
    entry.inFlight = (async () => {
      try {
        const value = await fetcher();
        this.set(key, value, { ttl: ttl ?? this.ttl, staleTtl: staleTtl ?? this.staleTtl });
      } catch (err) {
        if (typeof onError === "function") onError(err);
      } finally {
        const current = this.store.get(key);
        if (current) current.inFlight = null;
      }
    })();
  }
}

export class CircuitBreaker {
  constructor({ failureThreshold = 3, cooldownMs = 15000, halfOpenMax = 1 } = {}) {
    this.failureThreshold = failureThreshold;
    this.cooldownMs = cooldownMs;
    this.halfOpenMax = halfOpenMax;
    this.state = "closed";
    this.failures = 0;
    this.openedAt = 0;
    this.halfOpenAttempts = 0;
  }

  canRequest() {
    if (this.state === "closed") return true;
    const now = Date.now();
    if (this.state === "open") {
      if (now - this.openedAt >= this.cooldownMs) {
        this.state = "half_open";
        this.halfOpenAttempts = 0;
      } else {
        return false;
      }
    }
    if (this.state === "half_open") {
      if (this.halfOpenAttempts < this.halfOpenMax) {
        this.halfOpenAttempts += 1;
        return true;
      }
      return false;
    }
    return true;
  }

  recordSuccess() {
    this.state = "closed";
    this.failures = 0;
    this.openedAt = 0;
    this.halfOpenAttempts = 0;
  }

  recordFailure() {
    this.failures += 1;
    if (this.failures >= this.failureThreshold) {
      this.state = "open";
      this.openedAt = Date.now();
    }
  }

  isOpen() {
    return this.state === "open";
  }
}
