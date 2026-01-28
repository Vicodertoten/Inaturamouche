import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { createApp } from '../../server/app.js';

let server;
let baseUrl;
let originalFetch;
let app;

test.before(async () => {
  ({ app } = createApp());
  // start server on ephemeral port
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

test('GET /api/taxon/:id returns 400 BAD_REQUEST for invalid id', async () => {
  const res = await fetch(`${baseUrl}/api/taxon/not-a-number`);
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.deepEqual(body.error, { code: 'BAD_REQUEST', message: 'Bad request' });
  assert.ok(Array.isArray(body.issues));
});

test('GET /api/taxon/:id returns 404 TAXON_NOT_FOUND when iNaturalist returns empty results and passes locale', async () => {
  // capture requested URLs
  const requested = [];
  globalThis.fetch = async (url, opts) => {
    // forward requests to our test server to the real fetch implementation
    if (String(url).startsWith(baseUrl)) return originalFetch(url, opts);
    requested.push(String(url));
    // simulate ok response with empty results
    return {
      ok: true,
      status: 200,
      json: async () => ({ results: [] }),
      text: async () => JSON.stringify({ results: [] }),
    };
  };

  const res = await fetch(`${baseUrl}/api/taxon/999999?locale=en`);
  if (res.status !== 404) {
    const dbg = await (res.headers.get('content-type')?.includes('application/json') ? res.json().catch(() => null) : res.text().catch(() => null));
    console.error('DEBUG /api/taxon unexpected status', res.status, dbg);
  }
  assert.equal(res.status, 404);
  const body = await res.json();
  assert.deepEqual(body.error, { code: 'TAXON_NOT_FOUND', message: 'Taxon not found.' });
  // ensure the fetch to iNaturalist included locale=en
  assert.ok(requested.some((u) => u.includes('locale=en')));
});

test('GET /api/taxon/:id returns 500 INTERNAL_SERVER_ERROR when iNaturalist returns 500', async () => {
  globalThis.fetch = async (url, opts) => {
    if (String(url).startsWith(baseUrl)) return originalFetch(url, opts);
    // simulate non-ok 500 response
    return {
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      text: async () => 'upstream failure',
    };
  };

  const res = await fetch(`${baseUrl}/api/taxon/1234`);
  if (res.status !== 500) {
    const dbg = await (res.headers.get('content-type')?.includes('application/json') ? res.json().catch(() => null) : res.text().catch(() => null));
    console.error('DEBUG /api/taxon unexpected status', res.status, dbg);
  }
  assert.equal(res.status, 500);
  const body = await res.json();
  assert.deepEqual(body.error, { code: 'INTERNAL_SERVER_ERROR', message: 'Internal server error' });
});
