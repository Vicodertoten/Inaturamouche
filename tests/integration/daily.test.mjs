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

integrationTest('GET /api/daily/leaderboard is archived', async () => {
  const res = await fetch(`${baseUrl}/api/daily/leaderboard`);
  assert.equal(res.status, 410);
  const body = await res.json();
  assert.equal(body?.error?.code, 'DAILY_LEADERBOARD_ARCHIVED');
});

integrationTest('POST /api/daily/score is archived', async () => {
  const res = await fetch(`${baseUrl}/api/daily/score`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      pseudo: 'tester',
      score: 9,
      total: 10,
    }),
  });
  assert.equal(res.status, 410);
  const body = await res.json();
  assert.equal(body?.error?.code, 'DAILY_LEADERBOARD_ARCHIVED');
});
