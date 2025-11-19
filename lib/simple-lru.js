export class SimpleLRUCache {
  constructor({ max = 100, ttl = 0 } = {}) {
    this.max = max;
    this.ttl = ttl;
    this.store = new Map();
  }

  _now() {
    return Date.now();
  }

  _isExpired(entry, now = this._now()) {
    return Boolean(entry?.expires && entry.expires <= now);
  }

  _touch(key, entry) {
    if (!this.store.has(key)) return;
    this.store.delete(key);
    this.store.set(key, entry);
  }

  get(key) {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (this._isExpired(entry)) {
      this.store.delete(key);
      return undefined;
    }
    this._touch(key, entry);
    return entry.value;
  }

  set(key, value) {
    const expires = this.ttl ? this._now() + this.ttl : null;
    const entry = { value, expires };
    if (this.store.has(key)) {
      this.store.delete(key);
    }
    this.store.set(key, entry);
    this._enforceMax();
  }

  delete(key) {
    this.store.delete(key);
  }

  clear() {
    this.store.clear();
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
}
