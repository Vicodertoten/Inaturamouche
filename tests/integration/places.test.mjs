import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createApp } from '../../server/app.js';

let server;
let baseUrl;
let originalFetch;
let app;
let serverAvailable = true;

const SOCKET_SKIP_REASON = 'Socket binding not permitted in this environment';

async function listenOnEphemeralPort(instance) {
  return new Promise((resolve, reject) => {
    const onError = (err) => {
      if (err?.code === 'EPERM' || err?.code === 'EACCES') {
        resolve(false);
        return;
      }
      reject(err);
    };
    instance.once('error', onError);
    instance.listen(0, '127.0.0.1', () => {
      instance.removeListener('error', onError);
      resolve(true);
    });
  });
}

test.before(async () => {
  ({ app } = createApp());
  server = http.createServer(app);
  serverAvailable = await listenOnEphemeralPort(server);
  if (!serverAvailable) return;
  const addr = server.address();
  const port = typeof addr === 'object' ? addr.port : addr;
  baseUrl = `http://127.0.0.1:${port}`;
  originalFetch = globalThis.fetch;
});

test.after(async () => {
  if (serverAvailable && server?.listening) {
    await new Promise((resolve) => server.close(resolve));
  }
  if (originalFetch) {
    globalThis.fetch = originalFetch;
  }
});

function integrationTest(name, fn) {
  test(name, async (t) => {
    if (!serverAvailable) {
      t.skip(SOCKET_SKIP_REASON);
      return;
    }
    await fn(t);
  });
}

// Tests pour /api/places (autocomplete)
integrationTest('GET /api/places returns 400 BAD_REQUEST when q is missing', async () => {
  const res = await fetch(`${baseUrl}/api/places`);
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.error.code, 'BAD_REQUEST');
  assert.ok(Array.isArray(body.error.issues));
});

integrationTest('GET /api/places returns places autocomplete results', async () => {
  globalThis.fetch = async (url, opts) => {
    if (String(url).startsWith(baseUrl)) return originalFetch(url, opts);
    
    if (String(url).includes('/places/autocomplete')) {
      return {
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => ({
          results: [
            {
              id: 6753,
              name: 'Belgium',
              display_name: 'Belgium',
              place_type_name: 'Country',
              admin_level: 0,
              bounding_box_area: 30528.0
            }
          ]
        })
      };
    }

    return { ok: true, status: 200, json: async () => ({}) };
  };

  const res = await fetch(`${baseUrl}/api/places?q=belgium`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(Array.isArray(body));
  assert.equal(body.length, 1);
  assert.equal(body[0].id, 6753);
  assert.equal(body[0].name, 'Belgium');
});

integrationTest('GET /api/places accepts per_page parameter', async () => {
  globalThis.fetch = async (url, opts) => {
    if (String(url).startsWith(baseUrl)) return originalFetch(url, opts);
    
    if (String(url).includes('/places/autocomplete')) {
      const urlObj = new URL(url);
      const perPage = urlObj.searchParams.get('per_page');
      assert.equal(perPage, '20');
      
      return {
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => ({ results: [] })
      };
    }

    return { ok: true, status: 200, json: async () => ({ results: [] }) };
  };

  const res = await fetch(`${baseUrl}/api/places?q=test&per_page=20`);
  assert.equal(res.status, 200);
});

integrationTest('GET /api/places returns 500 INTERNAL_SERVER_ERROR on upstream error', async () => {
  globalThis.fetch = async (url, opts) => {
    if (String(url).startsWith(baseUrl)) return originalFetch(url, opts);
    
    throw new Error('Simulated API error');
  };

  const res = await fetch(`${baseUrl}/api/places?q=test`);
  assert.equal(res.status, 500);
  const body = await res.json();
  assert.equal(body.error.code, 'INTERNAL_SERVER_ERROR');
  assert.equal(body.error.message, 'Internal server error');
  assert.equal(typeof body.error.requestId, 'string');
});

// Tests pour /api/places/by-id
integrationTest('GET /api/places/by-id returns 400 BAD_REQUEST when ids is missing', async () => {
  const res = await fetch(`${baseUrl}/api/places/by-id`);
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.error.code, 'BAD_REQUEST');
  assert.ok(Array.isArray(body.error.issues));
});

integrationTest('GET /api/places/by-id returns empty array when ids is empty', async () => {
  const res = await fetch(`${baseUrl}/api/places/by-id?ids=`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(Array.isArray(body));
  assert.equal(body.length, 0);
});

integrationTest('GET /api/places/by-id returns places by IDs', async () => {
  globalThis.fetch = async (url, opts) => {
    if (String(url).startsWith(baseUrl)) return originalFetch(url, opts);
    
    if (String(url).includes('/places/')) {
      return {
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => ({
          results: [
            {
              id: 6753,
              name: 'Belgium',
              display_name: 'Belgium',
              place_type_name: 'Country',
              admin_level: 0,
              bounding_box_area: 30528.0
            },
            {
              id: 97394,
              name: 'France',
              display_name: 'France',
              place_type_name: 'Country',
              admin_level: 0,
              bounding_box_area: 551695.0
            }
          ]
        })
      };
    }

    return { ok: true, status: 200, json: async () => ({}) };
  };

  const res = await fetch(`${baseUrl}/api/places/by-id?ids=6753,97394`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(Array.isArray(body));
  assert.equal(body.length, 2);
  assert.equal(body[0].id, 6753);
  assert.equal(body[1].id, 97394);
});

integrationTest('GET /api/places/by-id accepts single ID', async () => {
  globalThis.fetch = async (url, opts) => {
    if (String(url).startsWith(baseUrl)) return originalFetch(url, opts);
    
    if (String(url).includes('/places/')) {
      return {
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => ({
          results: [
            {
              id: 6753,
              name: 'Belgium',
              display_name: 'Belgium',
              place_type_name: 'Country',
              admin_level: 0,
              bounding_box_area: 30528.0
            }
          ]
        })
      };
    }

    return { ok: true, status: 200, json: async () => ({}) };
  };

  const res = await fetch(`${baseUrl}/api/places/by-id?ids=6753`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(Array.isArray(body));
  assert.equal(body.length, 1);
});

integrationTest('GET /api/places/by-id returns 500 INTERNAL_SERVER_ERROR on upstream error', async () => {
  globalThis.fetch = async (url, opts) => {
    if (String(url).startsWith(baseUrl)) return originalFetch(url, opts);
    
    throw new Error('Simulated API error');
  };

  const res = await fetch(`${baseUrl}/api/places/by-id?ids=6753`);
  assert.equal(res.status, 500);
  const body = await res.json();
  assert.equal(body.error.code, 'INTERNAL_SERVER_ERROR');
  assert.equal(body.error.message, 'Internal server error');
  assert.equal(typeof body.error.requestId, 'string');
});

integrationTest('GET /api/places/by-id handles array-style results', async () => {
  globalThis.fetch = async (url, opts) => {
    if (String(url).startsWith(baseUrl)) return originalFetch(url, opts);
    
    if (String(url).includes('/places/')) {
      return {
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => [
          {
            id: 6753,
            name: 'Belgium',
            display_name: 'Belgium',
            place_type_name: 'Country',
            admin_level: 0,
            bounding_box_area: 30528.0
          }
        ]
      };
    }

    return { ok: true, status: 200, json: async () => ({}) };
  };

  const res = await fetch(`${baseUrl}/api/places/by-id?ids=6753`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(Array.isArray(body));
  assert.equal(body.length, 1);
});
