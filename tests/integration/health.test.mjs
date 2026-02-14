import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createApp } from '../../server/app.js';

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

integrationTest('GET /healthz returns 200 with ok status', async () => {
  const res = await fetch(`${baseUrl}/healthz`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.deepEqual(body, { ok: true });
});

integrationTest('GET /healthz returns valid JSON content type', async () => {
  const res = await fetch(`${baseUrl}/healthz`);
  assert.equal(res.status, 200);
  const contentType = res.headers.get('content-type');
  assert.ok(contentType.includes('application/json'));
});
