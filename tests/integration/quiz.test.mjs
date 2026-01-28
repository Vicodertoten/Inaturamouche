import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createApp } from '../../server/app.js';

let server;
let baseUrl;
let originalFetch;
let app;

const DEFAULT_TAXON_IDS = [101, 102, 103, 104];
const ICONIC_LURE_TAXON_IDS = [201, 202, 203, 204];
const ICONIC_NAME_TO_ID = {
  Animalia: 1,
  Plantae: 47126,
  Fungi: 47119,
  Insecta: 47158,
  Aves: 3,
  Mammalia: 40151,
  Reptilia: 26036,
  Amphibia: 20978,
  Mollusca: 47178,
  Arachnida: 47686,
};

const buildObservationResults = (taxonIds = DEFAULT_TAXON_IDS, { iconicTaxonId = 1 } = {}) =>
  taxonIds.map((id) => ({
    id: Number(id) * 100,
    uri: `https://www.inaturalist.org/observations/${id}`,
    observed_on_details: { month: 6, day: 15 },
    taxon: {
      id: Number(id),
      name: `Species ${id}`,
      preferred_common_name: `Species ${id}`,
      rank: 'species',
      iconic_taxon_id: iconicTaxonId,
      ancestor_ids: [iconicTaxonId, Number(id)],
    },
    photos: [{ id: Number(id) * 10, url: 'https://example.com/photo.jpg' }],
  }));

const createInatFetchMock = ({ expectedLocale } = {}) => async (url, opts) => {
  if (String(url).startsWith(baseUrl)) return originalFetch(url, opts);

  if (String(url).includes('/observations')) {
    const urlObj = new URL(url);
    const params = urlObj.searchParams;
    const iconicTaxa = params.get('iconic_taxa');
    if (expectedLocale && params.has('locale')) {
      const locale = params.get('locale');
      assert.equal(locale, expectedLocale);
    }
    if (iconicTaxa) {
      const iconicTaxonId = ICONIC_NAME_TO_ID[iconicTaxa] || 1;
      return {
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => ({
          total_results: 100,
          results: buildObservationResults(ICONIC_LURE_TAXON_IDS, { iconicTaxonId }),
        }),
      };
    }
    const rawTaxonIds = params.get('taxon_id');
    const taxonIds = rawTaxonIds
      ? rawTaxonIds
          .split(',')
          .map((value) => Number(value))
          .filter((value) => Number.isFinite(value))
      : DEFAULT_TAXON_IDS;
    const iconicTaxonId = taxonIds.includes(47126) ? 47126 : 1;
    return {
      ok: true,
      status: 200,
      headers: new Map([['content-type', 'application/json']]),
      json: async () => ({
        total_results: 100,
        results: buildObservationResults(taxonIds, { iconicTaxonId }),
      }),
    };
  }

  if (String(url).includes('/taxa/')) {
    const urlObj = new URL(url);
    const idsSegment = urlObj.pathname.split('/taxa/')[1] || '';
    const ids = idsSegment.split(',').filter(Boolean);
    return {
      ok: true,
      status: 200,
      headers: new Map([['content-type', 'application/json']]),
      json: async () => ({
        results: ids.map((id) => ({
          id: Number(id),
          name: `Species ${id}`,
          preferred_common_name: `Species ${id}`,
          rank: 'species',
          ancestors: [],
          ancestor_ids: [],
          observations_count: 100,
        })),
      }),
    };
  }

  return { ok: true, status: 200, json: async () => ({}) };
};

test.before(async () => {
  ({ app } = createApp());
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

test('GET /api/quiz-question accepts default params and returns 200', async () => {
  globalThis.fetch = createInatFetchMock();

  const res = await fetch(
    `${baseUrl}/api/quiz-question?locale=fr&media_type=images&game_mode=easy`
  );
  assert.equal(res.status, 200);
});

test('GET /api/quiz-question returns 400 BAD_REQUEST with invalid pack_id', async () => {
  const res = await fetch(`${baseUrl}/api/quiz-question?pack_id=invalid-pack-id`);
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.error.code, 'UNKNOWN_PACK');
  assert.equal(body.error.message, 'Unknown pack');
});

test('GET /api/quiz-question accepts valid taxon_ids parameter', async () => {
  globalThis.fetch = createInatFetchMock();

  const res = await fetch(`${baseUrl}/api/quiz-question?taxon_ids=47126&locale=fr`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(body.observation || body.error);
});

test('GET /api/quiz-question accepts locale parameter', async () => {
  globalThis.fetch = createInatFetchMock({ expectedLocale: 'en' });

  const res = await fetch(`${baseUrl}/api/quiz-question?taxon_ids=47126&locale=en`);
  assert.equal(res.status, 200);
});

test('GET /api/quiz-question handles seed parameter for deterministic results', async () => {
  globalThis.fetch = createInatFetchMock();

  const res1 = await fetch(`${baseUrl}/api/quiz-question?taxon_ids=47126&seed=test-seed-123`);
  assert.equal(res1.status, 200);
  
  const res2 = await fetch(`${baseUrl}/api/quiz-question?taxon_ids=47126&seed=test-seed-123`);
  assert.equal(res2.status, 200);
});

test('GET /api/quiz-question accepts place_id parameter', async () => {
  globalThis.fetch = createInatFetchMock();

  const res = await fetch(`${baseUrl}/api/quiz-question?place_id=6753&taxon_ids=47126`);
  assert.equal(res.status, 200);
});

test('GET /api/quiz-question accepts date range parameters', async () => {
  globalThis.fetch = createInatFetchMock();

  const res = await fetch(`${baseUrl}/api/quiz-question?taxon_ids=47126&d1=2024-01-01&d2=2024-12-31`);
  assert.equal(res.status, 200);
});

test('GET /api/quiz-question returns 503 POOL_UNAVAILABLE when no observations available', async () => {
  globalThis.fetch = async (url, opts) => {
    if (String(url).startsWith(baseUrl)) return originalFetch(url, opts);
    
    return {
      ok: true,
      status: 200,
      headers: new Map([['content-type', 'application/json']]),
      json: async () => ({
        total_results: 0,
        results: []
      })
    };
  };

  const res = await fetch(`${baseUrl}/api/quiz-question?taxon_ids=999999999`);
  assert.equal(res.status, 503);
  const body = await res.json();
  assert.equal(body.error.code, 'POOL_UNAVAILABLE');
});

test('GET /api/quiz-question handles bounding box parameters', async () => {
  globalThis.fetch = createInatFetchMock();

  const res = await fetch(`${baseUrl}/api/quiz-question?taxon_ids=47126&nelat=50&nelng=5&swlat=49&swlng=4`);
  assert.equal(res.status, 200);
});
