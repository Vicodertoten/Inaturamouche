import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createApp } from '../../server/app.js';
import { config } from '../../server/config/index.js';

let server;
let baseUrl;
let app;
let originalFetch;
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

function buildExternalFetchMock() {
  return async (url, opts) => {
    const rawUrl = String(url);
    if (rawUrl.startsWith(baseUrl)) {
      return originalFetch(url, opts);
    }

    if (rawUrl.includes('/v1/taxa/')) {
      const parsedUrl = new URL(rawUrl);
      const idsSegment = parsedUrl.pathname.split('/v1/taxa/')[1] || '';
      const ids = idsSegment.split(',').map((value) => Number(value)).filter((value) => Number.isFinite(value));
      const results = ids.map((id) => ({
        id,
        name: `Species ${id}`,
        preferred_common_name: `Species ${id}`,
        rank: 'species',
        ancestors: [],
        ancestor_ids: [id],
        observations_count: 100,
        wikipedia_url: `https://fr.wikipedia.org/wiki/Species_${id}`,
        default_photo: {
          url: 'https://example.com/photo.jpg',
        },
        url: `https://www.inaturalist.org/taxa/${id}`,
      }));

      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({ results }),
        text: async () => JSON.stringify({ results }),
      };
    }

    if (rawUrl.includes('generativelanguage.googleapis.com')) {
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [{ text: 'Ces deux especes se distinguent par leur morphologie et leur habitat.' }],
              },
            },
          ],
        }),
        text: async () => '',
      };
    }

    return {
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({}),
      text: async () => '{}',
    };
  };
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

integrationTest('POST /api/quiz/explain returns a valid explanation payload', async () => {
  globalThis.fetch = buildExternalFetchMock();

  const res = await fetch(`${baseUrl}/api/quiz/explain`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      correctId: 101,
      wrongId: 202,
      locale: 'fr',
    }),
  });

  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(typeof body.explanation, 'string');
  assert.ok(body.explanation.length > 0);
});

integrationTest('POST /api/quiz/explain rejects invalid payloads with standardized BAD_REQUEST errors', async () => {
  const res = await fetch(`${baseUrl}/api/quiz/explain`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      correctId: 101,
      wrongId: 101,
      locale: 'fr',
    }),
  });

  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.error.code, 'BAD_REQUEST');
  assert.equal(body.error.message, 'Bad request');
  assert.equal(typeof body.error.requestId, 'string');
  assert.ok(Array.isArray(body.error.issues));
});

integrationTest('POST /api/quiz/explain is rate-limited for abusive callers', async () => {
  globalThis.fetch = buildExternalFetchMock();
  const maxAttempts = Math.max(config.explainRateLimitPerMinute, 1) + 5;
  let limitedResponse = null;

  for (let i = 0; i < maxAttempts; i += 1) {
    const res = await fetch(`${baseUrl}/api/quiz/explain`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        correctId: 303,
        wrongId: 404,
        locale: 'fr',
      }),
    });
    if (res.status === 429) {
      limitedResponse = res;
      break;
    }
  }

  assert.ok(limitedResponse, 'Expected a 429 response from explain rate limiter');
  const body = await limitedResponse.json();
  assert.equal(limitedResponse.status, 429);
  assert.ok(
    ['EXPLAIN_RATE_LIMIT_EXCEEDED', 'EXPLAIN_DAILY_QUOTA_EXCEEDED'].includes(body.error.code),
    `Unexpected rate-limit error code: ${body.error.code}`
  );
  assert.equal(typeof body.error.requestId, 'string');
  assert.equal(limitedResponse.headers.get('x-request-id'), body.error.requestId);
});
