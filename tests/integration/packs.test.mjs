import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createApp } from '../../server/app.js';

let server;
let baseUrl;
let app;

test.before(async () => {
  ({ app } = createApp());
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const addr = server.address();
  const port = typeof addr === 'object' ? addr.port : addr;
  baseUrl = `http://127.0.0.1:${port}`;
});

test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

test('GET /api/packs returns 200 with packs list', async () => {
  const res = await fetch(`${baseUrl}/api/packs`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(Array.isArray(body));
});

test('GET /api/packs returns valid pack structure', async () => {
  const res = await fetch(`${baseUrl}/api/packs`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(body.length > 0);
  
  // Verify first pack has required properties
  const firstPack = body[0];
  assert.ok(firstPack.id);
  assert.ok(firstPack.type);
  assert.ok(firstPack.titleKey);
  assert.ok(firstPack.descriptionKey);
});

test('GET /api/packs includes custom pack', async () => {
  const res = await fetch(`${baseUrl}/api/packs`);
  assert.equal(res.status, 200);
  const body = await res.json();
  
  const customPack = body.find(p => p.id === 'custom');
  assert.ok(customPack, 'Custom pack should be included');
  assert.equal(customPack.type, 'custom');
});

test('GET /api/packs includes list-type packs', async () => {
  const res = await fetch(`${baseUrl}/api/packs`);
  assert.equal(res.status, 200);
  const body = await res.json();
  
  const listPacks = body.filter(p => p.type === 'list');
  assert.ok(listPacks.length > 0, 'Should have at least one list-type pack');
  
  // List packs should have taxa_ids
  const listPack = listPacks[0];
  assert.ok(Array.isArray(listPack.taxa_ids), 'List pack should have taxa_ids array');
  assert.ok(listPack.taxa_ids.length > 0, 'List pack should have at least one taxa ID');
});

test('GET /api/packs includes dynamic-type packs', async () => {
  const res = await fetch(`${baseUrl}/api/packs`);
  assert.equal(res.status, 200);
  const body = await res.json();
  
  const dynamicPacks = body.filter(p => p.type === 'dynamic');
  assert.ok(dynamicPacks.length > 0, 'Should have at least one dynamic-type pack');
  
  // Dynamic packs should have api_params
  const dynamicPack = dynamicPacks[0];
  assert.ok(typeof dynamicPack.api_params === 'object', 'Dynamic pack should have api_params object');
});

test('GET /api/packs includes european_mushrooms pack', async () => {
  const res = await fetch(`${baseUrl}/api/packs`);
  assert.equal(res.status, 200);
  const body = await res.json();
  
  const mushroomsPack = body.find(p => p.id === 'european_mushrooms');
  assert.ok(mushroomsPack, 'European mushrooms pack should be included');
  assert.equal(mushroomsPack.type, 'list');
  assert.ok(Array.isArray(mushroomsPack.taxa_ids));
});

test('GET /api/packs includes european_trees pack', async () => {
  const res = await fetch(`${baseUrl}/api/packs`);
  assert.equal(res.status, 200);
  const body = await res.json();
  
  const treesPack = body.find(p => p.id === 'european_trees');
  assert.ok(treesPack, 'European trees pack should be included');
  assert.equal(treesPack.type, 'list');
  assert.ok(Array.isArray(treesPack.taxa_ids));
});

test('GET /api/packs returns consistent data on multiple requests', async () => {
  const res1 = await fetch(`${baseUrl}/api/packs`);
  const body1 = await res1.json();
  
  const res2 = await fetch(`${baseUrl}/api/packs`);
  const body2 = await res2.json();
  
  assert.deepEqual(body1, body2, 'Packs should be consistent across requests');
});

test('GET /api/packs returns valid JSON content type', async () => {
  const res = await fetch(`${baseUrl}/api/packs`);
  assert.equal(res.status, 200);
  const contentType = res.headers.get('content-type');
  assert.ok(contentType.includes('application/json'));
});
