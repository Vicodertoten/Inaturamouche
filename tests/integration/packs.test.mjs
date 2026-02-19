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

integrationTest('GET /api/packs returns 200 with packs list', async () => {
  const res = await fetch(`${baseUrl}/api/packs`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(Array.isArray(body));
});

integrationTest('GET /api/packs returns valid pack structure', async () => {
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

integrationTest('GET /api/packs includes custom pack', async () => {
  const res = await fetch(`${baseUrl}/api/packs`);
  assert.equal(res.status, 200);
  const body = await res.json();
  
  const customPack = body.find(p => p.id === 'custom');
  assert.ok(customPack, 'Custom pack should be included');
  assert.equal(customPack.type, 'custom');
});

integrationTest('GET /api/packs includes list-type packs', async () => {
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

integrationTest('GET /api/packs includes dynamic-type packs', async () => {
  const res = await fetch(`${baseUrl}/api/packs`);
  assert.equal(res.status, 200);
  const body = await res.json();
  
  const dynamicPacks = body.filter(p => p.type === 'dynamic');
  assert.ok(dynamicPacks.length > 0, 'Should have at least one dynamic-type pack');
  
  // Dynamic packs should have api_params
  const dynamicPack = dynamicPacks[0];
  assert.ok(typeof dynamicPack.api_params === 'object', 'Dynamic pack should have api_params object');
});

integrationTest('GET /api/packs includes european_mushrooms pack', async () => {
  const res = await fetch(`${baseUrl}/api/packs`);
  assert.equal(res.status, 200);
  const body = await res.json();
  
  const mushroomsPack = body.find(p => p.id === 'european_mushrooms');
  assert.ok(mushroomsPack, 'European mushrooms pack should be included');
  assert.equal(mushroomsPack.type, 'list');
  assert.ok(Array.isArray(mushroomsPack.taxa_ids));
});

integrationTest('GET /api/packs includes european_trees pack', async () => {
  const res = await fetch(`${baseUrl}/api/packs`);
  assert.equal(res.status, 200);
  const body = await res.json();
  
  const treesPack = body.find(p => p.id === 'european_trees');
  assert.ok(treesPack, 'European trees pack should be included');
  assert.equal(treesPack.type, 'list');
  assert.ok(Array.isArray(treesPack.taxa_ids));
});

integrationTest('GET /api/packs returns consistent data on multiple requests', async () => {
  const res1 = await fetch(`${baseUrl}/api/packs`);
  const body1 = await res1.json();
  
  const res2 = await fetch(`${baseUrl}/api/packs`);
  const body2 = await res2.json();
  
  assert.deepEqual(body1, body2, 'Packs should be consistent across requests');
});

integrationTest('GET /api/packs returns valid JSON content type', async () => {
  const res = await fetch(`${baseUrl}/api/packs`);
  assert.equal(res.status, 200);
  const contentType = res.headers.get('content-type');
  assert.ok(contentType.includes('application/json'));
});

integrationTest('GET /api/packs exposes V2 metadata for non-custom packs', async () => {
  const res = await fetch(`${baseUrl}/api/packs`);
  assert.equal(res.status, 200);
  const body = await res.json();
  const nonCustom = body.find((pack) => pack.id !== 'custom');
  assert.ok(nonCustom);
  assert.ok(nonCustom.category);
  assert.ok(nonCustom.level);
  assert.ok(nonCustom.visibility);
  assert.equal(typeof nonCustom.sortWeight, 'number');
});

integrationTest('GET /api/packs/home returns expected sections contract', async () => {
  const res = await fetch(`${baseUrl}/api/packs/home?region=belgium`);
  assert.equal(res.status, 200);
  const body = await res.json();

  assert.ok(Array.isArray(body.sections));
  assert.equal(body.sections.length, 3);
  assert.ok(body.sections.every((section) => section.id && section.titleKey && Array.isArray(section.packs)));
  assert.equal(body.customEntry?.id, 'custom');
  assert.ok(body.customEntry?.titleKey);
  assert.ok(body.customEntry?.descriptionKey);
});

integrationTest('GET /api/packs/home is deterministic across identical requests', async () => {
  const res1 = await fetch(`${baseUrl}/api/packs/home?region=france&recent_pack_ids=world_birds`);
  assert.equal(res1.status, 200);
  const body1 = await res1.json();

  const res2 = await fetch(`${baseUrl}/api/packs/home?region=france&recent_pack_ids=world_birds`);
  assert.equal(res2.status, 200);
  const body2 = await res2.json();

  assert.deepEqual(body1, body2);
});

integrationTest('GET /api/packs/home prioritizes local packs in near_you section', async () => {
  const res = await fetch(`${baseUrl}/api/packs/home?region=belgium`);
  assert.equal(res.status, 200);
  const body = await res.json();
  const nearYou = body.sections.find((section) => section.id === 'near_you');
  assert.ok(nearYou);
  assert.ok(nearYou.packs.length > 0);
  assert.equal(nearYou.packs[0].region, 'belgium');
});

integrationTest('GET /api/packs/home applies region_override over region', async () => {
  const res = await fetch(`${baseUrl}/api/packs/home?region=world&region_override=belgium`);
  assert.equal(res.status, 200);
  const body = await res.json();
  const nearYou = body.sections.find((section) => section.id === 'near_you');
  assert.ok(nearYou);
  assert.ok(nearYou.packs.length > 0);
  assert.equal(nearYou.packs[0].region, 'belgium');
});
