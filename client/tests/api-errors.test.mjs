import test from 'node:test';
import assert from 'node:assert/strict';

let originalFetch;
let originalWindow;
let originalLocalStorage;

test.before(() => {
  originalFetch = globalThis.fetch;
  originalWindow = globalThis.window;
  originalLocalStorage = globalThis.localStorage;
});

test.after(() => {
  globalThis.fetch = originalFetch;
  globalThis.window = originalWindow;
  globalThis.localStorage = originalLocalStorage;
});

test('API error code is mapped to localized message (FR)', async () => {
  // Mock a minimal browser env
  const listeners = new Map();
  globalThis.window = {
    localStorage: { getItem: (k) => (k === 'inaturamouche_lang' ? 'fr' : null) },
    addEventListener: (name, cb) => listeners.set(name, cb),
    removeEventListener: (name) => listeners.delete(name),
    dispatchEvent: (evt) => {
      const cb = listeners.get('inaturamouche:notify');
      if (cb) cb(evt);
    },
  };
  globalThis.localStorage = globalThis.window.localStorage;

  const events = [];
  listeners.set('inaturamouche:notify', (e) => events.push(e.detail));

  globalThis.fetch = async (url, opts) => {
    events.push({ type: 'fetch', url: String(url) });
    return {
      ok: false,
      status: 404,
      json: async () => ({ error: { code: 'TAXON_NOT_FOUND', message: 'Taxon not found.' } }),
      text: async () => JSON.stringify({ error: { code: 'TAXON_NOT_FOUND' } }),
    };
  };

  // quick sanity check: import notifier and call it directly
  const { notify: notify1 } = await import('../src/services/notifications.js');
  notify1('sanity');
  assert.ok(events.length > 0, 'sanity notify should have dispatched');
  events.length = 0;

  // directly test notifyApiError mapping
  const { notifyApiError } = await import('../src/services/api.js');
  const err = new Error('Taxon not found.');
  err.code = 'TAXON_NOT_FOUND';
  notifyApiError(err);

  assert.ok(events.length >= 1, 'should have at least one notification');
  const apiEvent = events[0];
  assert.equal(apiEvent.type, 'error');
  // localized French string
  assert.equal(apiEvent.message, 'Taxon non trouvé.');
});

test('API error code is mapped to localized message (EN)', async () => {
  const listeners = new Map();
  globalThis.window = {
    localStorage: { getItem: (k) => (k === 'inaturamouche_lang' ? 'en' : null) },
    addEventListener: (name, cb) => listeners.set(name, cb),
    removeEventListener: (name) => listeners.delete(name),
    dispatchEvent: (evt) => {
      const cb = listeners.get('inaturamouche:notify');
      if (cb) cb(evt);
    },
  };
  globalThis.localStorage = globalThis.window.localStorage;

  const events = [];
  listeners.set('inaturamouche:notify', (e) => events.push(e.detail));

  globalThis.fetch = async (url, opts) => {
    events.push({ type: 'fetch', url: String(url) });
    return {
      ok: false,
      status: 404,
      json: async () => ({ error: { code: 'TAXON_NOT_FOUND', message: 'Taxon not found.' } }),
      text: async () => JSON.stringify({ error: { code: 'TAXON_NOT_FOUND' } }),
    };
  };

  // directly test notifyApiError mapping
  const { notifyApiError } = await import('../src/services/api.js');
  const err = new Error('Taxon not found.');
  err.code = 'TAXON_NOT_FOUND';
  notifyApiError(err);

  assert.ok(events.length >= 1, 'should have at least one notification');
  const apiEvent = events[0];
  assert.equal(apiEvent.type, 'error');
  // localized English string
  assert.equal(apiEvent.message, 'Taxon not found.');
});
