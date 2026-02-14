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
  // start server on ephemeral port
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

integrationTest('GET /api/taxon/:id returns 400 BAD_REQUEST for invalid id', async () => {
  const res = await fetch(`${baseUrl}/api/taxon/not-a-number`);
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.error.code, 'BAD_REQUEST');
  assert.equal(body.error.message, 'Bad request');
  assert.equal(typeof body.error.requestId, 'string');
  assert.ok(Array.isArray(body.error.issues));
});

integrationTest('GET /api/taxon/:id returns 404 TAXON_NOT_FOUND when iNaturalist returns empty results and passes locale', async () => {
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
  assert.equal(res.status, 404);
  const body = await res.json();
  assert.equal(body.error.code, 'TAXON_NOT_FOUND');
  assert.equal(body.error.message, 'Taxon not found.');
  assert.equal(typeof body.error.requestId, 'string');
  // ensure the fetch to iNaturalist included locale=en
  assert.ok(requested.some((u) => u.includes('locale=en')));
});

integrationTest('GET /api/taxon/:id returns 500 INTERNAL_SERVER_ERROR when iNaturalist returns 500', async () => {
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
  assert.equal(res.status, 500);
  const body = await res.json();
  assert.equal(body.error.code, 'INTERNAL_SERVER_ERROR');
  assert.equal(body.error.message, 'Internal server error');
  assert.equal(typeof body.error.requestId, 'string');
});

integrationTest('GET unknown route returns NOT_FOUND with requestId and x-request-id header', async () => {
  const res = await fetch(`${baseUrl}/api/route-that-does-not-exist`);
  assert.equal(res.status, 404);
  const body = await res.json();
  assert.equal(body.error.code, 'NOT_FOUND');
  assert.equal(body.error.message, 'Not Found');
  assert.equal(typeof body.error.requestId, 'string');
  assert.equal(res.headers.get('x-request-id'), body.error.requestId);
});

integrationTest('GET unknown route keeps incoming x-request-id in error payload', async () => {
  const customRequestId = 'test-request-id-42';
  const res = await fetch(`${baseUrl}/api/route-that-does-not-exist`, {
    headers: {
      'x-request-id': customRequestId,
    },
  });
  assert.equal(res.status, 404);
  const body = await res.json();
  assert.equal(body.error.requestId, customRequestId);
  assert.equal(res.headers.get('x-request-id'), customRequestId);
});
