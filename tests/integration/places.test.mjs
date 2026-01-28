import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createApp } from '../../server/app.js';

let server;
let baseUrl;
let originalFetch;
let app;

test.before(async () => {
  ({ app } = createApp());
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const addr = server.address();
  const port = typeof addr === 'object' ? addr.port : addr;
  baseUrl = `http://127.0.0.1:${port}`;
  originalFetch = globalThis.fetch;
});

test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
  globalThis.fetch = originalFetch;
});

// Tests pour /api/places (autocomplete)
test('GET /api/places returns 400 BAD_REQUEST when q is missing', async () => {
  const res = await fetch(`${baseUrl}/api/places`);
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.error.code, 'BAD_REQUEST');
  assert.ok(Array.isArray(body.issues));
});

test('GET /api/places returns places autocomplete results', async () => {
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

test('GET /api/places accepts per_page parameter', async () => {
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

test('GET /api/places returns empty array on error', async () => {
  globalThis.fetch = async (url, opts) => {
    if (String(url).startsWith(baseUrl)) return originalFetch(url, opts);
    
    throw new Error('Simulated API error');
  };

  const res = await fetch(`${baseUrl}/api/places?q=test`);
  assert.equal(res.status, 500);
  const body = await res.json();
  assert.ok(Array.isArray(body));
  assert.equal(body.length, 0);
});

// Tests pour /api/places/by-id
test('GET /api/places/by-id returns 400 BAD_REQUEST when ids is missing', async () => {
  const res = await fetch(`${baseUrl}/api/places/by-id`);
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.error.code, 'BAD_REQUEST');
  assert.ok(Array.isArray(body.issues));
});

test('GET /api/places/by-id returns empty array when ids is empty', async () => {
  const res = await fetch(`${baseUrl}/api/places/by-id?ids=`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(Array.isArray(body));
  assert.equal(body.length, 0);
});

test('GET /api/places/by-id returns places by IDs', async () => {
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

test('GET /api/places/by-id accepts single ID', async () => {
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

test('GET /api/places/by-id returns empty array on error', async () => {
  globalThis.fetch = async (url, opts) => {
    if (String(url).startsWith(baseUrl)) return originalFetch(url, opts);
    
    throw new Error('Simulated API error');
  };

  const res = await fetch(`${baseUrl}/api/places/by-id?ids=6753`);
  assert.equal(res.status, 500);
  const body = await res.json();
  assert.ok(Array.isArray(body));
  assert.equal(body.length, 0);
});

test('GET /api/places/by-id handles array-style results', async () => {
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
