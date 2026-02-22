import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createApp } from '../../server/app.js';

let server;
let baseUrl;
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
  const { app } = createApp();
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

integrationTest('POST /api/metrics/events accepts a valid batch', async () => {
  const res = await fetch(`${baseUrl}/api/metrics/events`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      events: [
        {
          name: 'app_open',
          session_id: 'metrics-session-a',
          properties: { route: '/' },
        },
        {
          name: 'round_start',
          session_id: 'metrics-session-a',
          properties: { mode: 'easy' },
        },
      ],
    }),
  });

  assert.equal(res.status, 202);
  const body = await res.json();
  assert.equal(body.success, true);
  assert.equal(body.accepted, 2);
});

integrationTest('GET /api/metrics/dashboard returns snapshot when enabled', async () => {
  const res = await fetch(`${baseUrl}/api/metrics/dashboard?window_hours=1`);
  const body = await res.json();

  if (res.status === 200) {
    assert.equal(typeof body.generated_at, 'string');
    assert.equal(typeof body.window_hours, 'number');
    assert.ok(body.core && typeof body.core === 'object');
    assert.ok(body.core.kpi && typeof body.core.kpi === 'object');
    return;
  }

  assert.ok(res.status === 401 || res.status === 503);
  assert.ok(
    body?.error?.code === 'UNAUTHORIZED' || body?.error?.code === 'METRICS_DASHBOARD_DISABLED'
  );
});
