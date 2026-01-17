import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import app from '../../server.js';

let server;
let baseUrl;

test.before(async () => {
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const addr = server.address();
  const port = typeof addr === 'object' ? addr.port : addr;
  baseUrl = `http://127.0.0.1:${port}`;
});

test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

test('GET /healthz returns 200 with ok status', async () => {
  const res = await fetch(`${baseUrl}/healthz`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.deepEqual(body, { ok: true });
});

test('GET /healthz returns valid JSON content type', async () => {
  const res = await fetch(`${baseUrl}/healthz`);
  assert.equal(res.status, 200);
  const contentType = res.headers.get('content-type');
  assert.ok(contentType.includes('application/json'));
});
