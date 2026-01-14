/**
 * Builds a stable cache key by sorting keys and flattening arrays.
 *
 * @param {Record<string, string | number | boolean | null | undefined | Array<string | number>>} [obj]
 * @returns {string}
 */
export function buildCacheKey(obj) {
  return Object.keys(obj || {})
    .sort()
    .map((key) => {
      const value = obj[key];
      return `${key}=${Array.isArray(value) ? value.join(",") : value}`;
    })
    .join("|");
}

/**
 * Returns a shuffled copy of an array using Fisher-Yates.
 *
 * @template T
 * @param {T[]} arr
 * @param {() => number} [rng]
 * @returns {T[]}
 */
export function shuffleFisherYates(arr, rng = Math.random) {
  const copy = Array.isArray(arr) ? arr.slice() : [];
  const random = typeof rng === "function" ? rng : Math.random;
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

const hashSeed = (input) => {
  let h = 1779033703 ^ input.length;
  for (let i = 0; i < input.length; i++) {
    h = Math.imul(h ^ input.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  h ^= h >>> 16;
  return h >>> 0;
};

const mulberry32 = (seed) => {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let x = t;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
};

/**
 * Creates a deterministic RNG function for a given seed string.
 *
 * @param {string} seed
 * @returns {() => number}
 */
export function createSeededRandom(seed) {
  const normalized = String(seed ?? "");
  const hashed = hashSeed(normalized);
  return mulberry32(hashed);
}

/**
 * Creates a shuffled "deck" (array) from the provided items.
 *
 * @template T
 * @param {T[]} items
 * @param {() => number} [rng]
 * @returns {T[]}
 */
export function createShuffledDeck(items, rng) {
  return shuffleFisherYates(items, rng);
}

/**
 * Draws the next item from a deck. Returns null if empty.
 * - Default: LIFO (pop) for backwards compatibility.
 * - If a custom RNG is provided, draws a random index for deterministic draws.
 *
 * @template T
 * @param {T[]} deck
 * @param {() => number} [rng]
 * @returns {T|null}
 */
export function drawFromDeck(deck, rng) {
  if (!Array.isArray(deck) || deck.length === 0) return null;
  const random = typeof rng === "function" ? rng : null;
  if (!random || random === Math.random) {
    return deck.pop() ?? null;
  }
  const idx = Math.floor(random() * deck.length);
  const [picked] = deck.splice(idx, 1);
  return picked ?? null;
}

/**
 * Circular history buffer to prevent immediate repeats.
 *
 * @template T
 */
export class HistoryBuffer {
  /**
   * @param {number} limit
   */
  constructor(limit = 50) {
    this.limit = Math.max(0, Math.trunc(limit));
    this.buffer = new Array(this.limit);
    this.cursor = 0;
    this.size = 0;
    this.set = new Set();
  }

  /**
   * @returns {number}
   */
  capacity() {
    return this.limit;
  }

  /**
   * @returns {number}
   */
  length() {
    return this.size;
  }

  /**
   * @param {T} value
   * @returns {boolean}
   */
  has(value) {
    return this.set.has(String(value));
  }

  /**
   * @param {T} value
   */
  add(value) {
    if (this.limit <= 0) return;
    const key = String(value);
    if (this.set.has(key)) return;
    if (this.size < this.limit) {
      this.buffer[this.cursor] = key;
      this.set.add(key);
      this.cursor = (this.cursor + 1) % this.limit;
      this.size += 1;
      return;
    }
    const evicted = this.buffer[this.cursor];
    if (evicted != null) this.set.delete(evicted);
    this.buffer[this.cursor] = key;
    this.set.add(key);
    this.cursor = (this.cursor + 1) % this.limit;
  }

  /**
   * @param {number} nextLimit
   */
  resize(nextLimit) {
    const newLimit = Math.max(0, Math.trunc(nextLimit));
    if (newLimit === this.limit) return;
    const values = this.values();
    this.limit = newLimit;
    this.buffer = new Array(this.limit);
    this.cursor = 0;
    this.size = 0;
    this.set = new Set();
    values.slice(-this.limit).forEach((val) => this.add(val));
  }

  clear() {
    this.buffer = new Array(this.limit);
    this.cursor = 0;
    this.size = 0;
    this.set.clear();
  }

  /**
   * Returns values from oldest to newest.
   *
   * @returns {string[]}
   */
  values() {
    if (this.size === 0 || this.limit === 0) return [];
    const out = [];
    for (let i = 0; i < this.size; i++) {
      const idx = (this.cursor - this.size + i + this.limit) % this.limit;
      const value = this.buffer[idx];
      if (value != null) out.push(value);
    }
    return out;
  }
}

/**
 * Computes Lowest Common Ancestor depth between two ancestor id arrays.
 *
 * @param {(string|number)[]} [ancA=[]]
 * @param {(string|number)[]} [ancB=[]]
 * @returns {number}
 */
export function lcaDepth(ancA = [], ancB = []) {
  const len = Math.min(ancA.length, ancB.length);
  let i = 0;
  while (i < len && ancA[i] === ancB[i]) i++;
  return i;
}

/**
 * Computes the effective cooldown length to avoid repeating target taxa too frequently.
 * - Caps the cooldown to the available unique taxa minus the number of choices to avoid deadlocks.
 * - Returns 0 if baseN is non-positive or invalid.
 *
 * @param {number} baseN Desired cooldown depth (questions before a taxon can reappear).
 * @param {number} taxonListLen Number of unique taxa available in the current pool.
 * @param {number} quizChoices Number of answer slots (used to preserve enough taxa for one question).
 * @returns {number} Effective cooldown length respecting pool capacity.
 */
export function effectiveCooldownN(baseN, taxonListLen, quizChoices) {
  if (!Number.isFinite(baseN) || baseN <= 0) return 0;
  const cap = Math.max(0, (taxonListLen || 0) - (quizChoices || 0));
  return Math.max(0, Math.min(baseN, cap));
}

/**
 * Returns the current daily seed string (YYYY-MM-DD) based on UTC time.
 * Ensures all users see the same challenge for the same 24h window.
 *
 * @param {Date} [date] Optional date object (default: now).
 * @returns {string}
 */
export function getDailySeed(date) {
  const now = date || new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Returns the sequential number of the daily challenge.
 * Useful for the "Daily #24" display.
 *
 * @param {string|number} [startDate] The launch date of the feature (default: 2023-10-01).
 * @returns {number}
 */
export function getDailyChallengeId(startDate = "2023-10-01") {
  const start = new Date(startDate).getTime();
  const now = Date.now();
  const msPerDay = 86400000;
  return Math.floor((now - start) / msPerDay) + 1;
}
/**
 * @typedef {import("../types/inaturalist").InatObservation} InatObservation
 */
