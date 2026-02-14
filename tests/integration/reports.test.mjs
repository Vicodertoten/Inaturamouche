import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createApp } from '../../server/app.js';
import { config } from '../../server/config/index.js';

let server;
let baseUrl;
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
});

test.after(async () => {
  if (serverAvailable && server?.listening) {
    await new Promise((resolve) => server.close(resolve));
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

integrationTest('POST /api/reports accepts a valid report payload', async () => {
  const res = await fetch(`${baseUrl}/api/reports`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      description: 'Une photo est floue sur une question en mode facile.',
      url: 'https://example.test/play',
      userAgent: 'integration-test',
      website: '',
    }),
  });

  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.success, true);
  assert.equal(typeof body.reportId, 'string');
});

integrationTest('POST /api/reports returns 202 and does not store when honeypot is filled', async () => {
  const res = await fetch(`${baseUrl}/api/reports`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      description: 'Spam payload',
      website: 'bot-filled-value',
    }),
  });

  assert.equal(res.status, 202);
  const body = await res.json();
  assert.equal(body.success, true);
  assert.equal(body.accepted, true);
});

integrationTest('POST /api/reports validates payload with standardized BAD_REQUEST errors', async () => {
  const res = await fetch(`${baseUrl}/api/reports`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      description: 'bad',
    }),
  });

  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.error.code, 'BAD_REQUEST');
  assert.equal(body.error.message, 'Bad request');
  assert.equal(typeof body.error.requestId, 'string');
  assert.ok(Array.isArray(body.error.issues));
});

integrationTest('POST /api/reports is protected by anti-spam rate limiting', async () => {
  const maxAttempts = Math.max(config.reportsRateLimitPerWindow, 1) + 5;
  let limitedResponse = null;

  for (let i = 0; i < maxAttempts; i += 1) {
    const res = await fetch(`${baseUrl}/api/reports`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        description: `Signalement de charge #${i + 1} avec un texte assez long pour passer la validation.`,
      }),
    });
    if (res.status === 429) {
      limitedResponse = res;
      break;
    }
  }

  assert.ok(limitedResponse, 'Expected a 429 response from reports limiter');
  const body = await limitedResponse.json();
  assert.equal(limitedResponse.status, 429);
  assert.equal(body.error.code, 'REPORT_RATE_LIMIT_EXCEEDED');
  assert.equal(typeof body.error.requestId, 'string');
  assert.equal(limitedResponse.headers.get('x-request-id'), body.error.requestId);
});
