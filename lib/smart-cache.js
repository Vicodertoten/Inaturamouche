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
  /**
   * Create a SmartCache instance.
   * @param {object} [options]
   * @param {number} [options.max=100] Maximum number of entries before LRU eviction.
   * @param {number} [options.ttl=0] Time-to-live in ms (0 = no TTL).
   * @param {number} [options.staleTtl=0] Extra ms an entry stays servable while stale (stale-while-revalidate window).
   */
  constructor({ max = 100, ttl = 0, staleTtl = 0 } = {}) {
    this.max = max;
    this.ttl = ttl;
    this.staleTtl = staleTtl;
    this.store = new Map();
    this.inFlightRequests = new Map(); // Request Coalescing: track in-flight requests
  }

  /** @returns {number} Current timestamp in ms. */
  _now() {
    return Date.now();
  }

  /**
   * Build an internal cache entry wrapper.
   * @param {*} value The cached value.
   * @param {object} [options]
   * @param {number} [options.ttl] Override TTL for this entry.
   * @param {number} [options.staleTtl] Override stale TTL for this entry.
   * @returns {{ value: *, freshUntil: number|null, staleUntil: number|null, createdAt: number, inFlight: Promise|null }}
   */
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

  /**
   * Check if an entry has expired beyond the stale window.
   * @param {object} entry Cache entry.
   * @param {number} [now] Current timestamp.
   * @returns {boolean}
   */
  _isExpired(entry, now = this._now()) {
    return Boolean(entry?.staleUntil && entry.staleUntil <= now);
  }

  /**
   * Check if an entry is stale (past TTL but within stale window).
   * @param {object} entry Cache entry.
   * @param {number} [now] Current timestamp.
   * @returns {boolean}
   */
  _isStale(entry, now = this._now()) {
    return Boolean(entry?.freshUntil && entry.freshUntil <= now);
  }

  /**
   * Move an entry to the end of the Map (most-recently used) for LRU ordering.
   * @param {string} key
   * @param {object} entry
   */
  _touch(key, entry) {
    if (!this.store.has(key)) return;
    this.store.delete(key);
    this.store.set(key, entry);
  }

  /**
   * Get a cache entry with metadata (staleness info).
   * @param {string} key
   * @returns {{ value: *, isStale: boolean, freshUntil: number|null, staleUntil: number|null } | null}
   */
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

  /**
   * Get a cached value.
   * @param {string} key
   * @param {object} [options]
   * @param {boolean} [options.allowStale=false] If true, return stale values instead of undefined.
   * @returns {*} The cached value, or undefined if missing/expired/stale.
   */
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

  /**
   * Store a value in the cache. Triggers LRU eviction if max size exceeded.
   * @param {string} key
   * @param {*} value
   * @param {object} [options] Optional ttl/staleTtl overrides.
   */
  set(key, value, options = {}) {
    const entry = this._buildEntry(value, options);
    if (this.store.has(key)) {
      this.store.delete(key);
    }
    this.store.set(key, entry);
    this._enforceMax();
  }

  /** Remove a key from the cache and cancel any in-flight request. @param {string} key */
  delete(key) {
    this.store.delete(key);
    this.inFlightRequests.delete(key); // Clean up in-flight request if exists
  }

  /** Remove all entries and cancel all in-flight requests. */
  clear() {
    this.store.clear();
    this.inFlightRequests.clear(); // Clear all in-flight requests
  }

  /** Remove all expired entries from the cache. */
  prune() {
    const now = this._now();
    for (const [key, entry] of this.store.entries()) {
      if (this._isExpired(entry, now)) this.store.delete(key);
    }
  }

  /** Evict oldest entries (LRU) until cache size is within max. */
  _enforceMax() {
    if (!this.max || this.max <= 0) return;
    while (this.store.size > this.max) {
      const oldestKey = this.store.keys().next().value;
      this.store.delete(oldestKey);
    }
  }

  /**
   * Get a cached value or fetch it. Supports stale-while-revalidate and request coalescing.
   * @param {string} key Cache key.
   * @param {() => Promise<*>} fetcher Async function that produces the value on cache miss.
   * @param {object} [options]
   * @param {boolean} [options.allowStale=true] Serve stale values while revalidating.
   * @param {boolean} [options.background=true] Revalidate in background (true) or blocking (false).
   * @param {(err: Error) => void} [options.onError] Error handler for background revalidation.
   * @param {number} [options.ttl] Override default TTL.
   * @param {number} [options.staleTtl] Override default stale TTL.
   * @returns {Promise<*>} The cached or freshly fetched value.
   */
  async getOrFetch(
    key,
    fetcher,
    { allowStale = true, background = true, onError, ttl, staleTtl, resolveEntryOptions } = {}
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
          this._revalidate(key, fetcher, { onError, ttl, staleTtl, resolveEntryOptions });
          this._touch(key, entry);
          return entry.value;
        }
      }
    }
    return this._fetchWithCoalescing(key, fetcher, { onError, ttl, staleTtl, resolveEntryOptions });
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
  async _fetchWithCoalescing(key, fetcher, { onError, ttl, staleTtl, resolveEntryOptions } = {}) {
    // Request Coalescing: reuse in-flight request if one exists
    if (this.inFlightRequests.has(key)) {
      return this.inFlightRequests.get(key);
    }

    // Create new in-flight promise
    const promise = this._fetchAndSet(key, fetcher, { onError, ttl, staleTtl, resolveEntryOptions })
      .finally(() => {
        // Clean up after request completes
        this.inFlightRequests.delete(key);
      });

    // Store the promise for request coalescing
    this.inFlightRequests.set(key, promise);
    return promise;
  }

  /**
   * Execute the fetcher and store the result.
   * @param {string} key
   * @param {() => Promise<*>} fetcher
   * @param {object} [options]
   * @returns {Promise<*>}
   */
  async _fetchAndSet(key, fetcher, { onError, ttl, staleTtl, resolveEntryOptions } = {}) {
    try {
      const value = await fetcher();
      const resolvedEntryOptions =
        typeof resolveEntryOptions === "function"
          ? resolveEntryOptions(value) || {}
          : {};
      this.set(key, value, {
        ttl: resolvedEntryOptions.ttl ?? ttl ?? this.ttl,
        staleTtl: resolvedEntryOptions.staleTtl ?? staleTtl ?? this.staleTtl,
      });
      return value;
    } catch (err) {
      if (typeof onError === "function") onError(err);
      throw err;
    }
  }

  /**
   * Revalidate a stale entry in the background. If revalidation is already in
   * flight for this key, this call is a no-op.
   * @param {string} key
   * @param {() => Promise<*>} fetcher
   * @param {object} [options]
   */
  _revalidate(key, fetcher, { onError, ttl, staleTtl, resolveEntryOptions } = {}) {
    const entry = this.store.get(key);
    if (!entry) return;
    if (entry.inFlight) return;
    entry.inFlight = (async () => {
      try {
        const value = await fetcher();
        const resolvedEntryOptions =
          typeof resolveEntryOptions === "function"
            ? resolveEntryOptions(value) || {}
            : {};
        this.set(key, value, {
          ttl: resolvedEntryOptions.ttl ?? ttl ?? this.ttl,
          staleTtl: resolvedEntryOptions.staleTtl ?? staleTtl ?? this.staleTtl,
        });
      } catch (err) {
        if (typeof onError === "function") onError(err);
      } finally {
        const current = this.store.get(key);
        if (current) current.inFlight = null;
      }
    })();
  }
}

/**
 * Circuit breaker for external service calls.
 *
 * States: **closed** (passing) → **open** (blocking) → **half_open** (testing).
 * @see https://martinfowler.com/bliki/CircuitBreaker.html
 */
export class CircuitBreaker {
  /**
   * @param {object} [options]
   * @param {number} [options.failureThreshold=3] Consecutive failures before opening.
   * @param {number} [options.cooldownMs=15000] Time in open state before trying half-open.
   * @param {number} [options.halfOpenMax=1] Requests allowed in half-open state.
   */
  constructor({ failureThreshold = 3, cooldownMs = 15000, halfOpenMax = 1 } = {}) {
    this.failureThreshold = failureThreshold;
    this.cooldownMs = cooldownMs;
    this.halfOpenMax = halfOpenMax;
    this.state = "closed";
    this.failures = 0;
    this.openedAt = 0;
    this.halfOpenAttempts = 0;
  }

  /** @returns {boolean} Whether a request is allowed through the breaker. */
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

  /** Record a successful response — resets the breaker to closed. */
  recordSuccess() {
    this.state = "closed";
    this.failures = 0;
    this.openedAt = 0;
    this.halfOpenAttempts = 0;
  }

  /** Record a failed response — opens the breaker if threshold reached. */
  recordFailure() {
    this.failures += 1;
    if (this.failures >= this.failureThreshold) {
      this.state = "open";
      this.openedAt = Date.now();
    }
  }

  /** @returns {boolean} True when the breaker is in the open (blocking) state. */
  isOpen() {
    return this.state === "open";
  }
}
