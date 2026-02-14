import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeObservation, getObservationPool } from '../server/services/observationPool.js';
import { questionCache } from '../server/cache/questionCache.js';

test('sanitizeObservation extracts photos, sounds and taxon info', () => {
  const raw = {
    id: 123,
    uri: 'u',
    photos: [{ id: 1, url: 'http://a', attribution: 'A' }],
    sounds: [{ id: 5, file_url: 'http://s', attribution: 'S' }],
    observed_on_details: { month: 6, day: 7 },
    taxon: { id: 42, name: 'Taxon42', ancestor_ids: [1, 2], iconic_taxon_id: 10 },
  };

  const s = sanitizeObservation(raw);
  assert.equal(s.id, 123);
  assert.equal(Array.isArray(s.photos), true);
  assert.equal(s.photos[0].url, 'http://a');
  assert.equal(s.taxon.id, 42);
  assert.deepEqual(s.observedMonthDay, { month: 6, day: 7 });
});

test('getObservationPool returns cached pool when cache hit', async () => {
  const fakePool = {
    taxonList: ['1'],
    byTaxon: new Map([['1', [{ id: 1, taxon: { id: 1 }, photos: [{ id: 1, url: 'u' }] }]]]),
  };
  const cacheEntry = { value: fakePool, isStale: false };
  const originalGetEntry = questionCache.getEntry.bind(questionCache);
  questionCache.getEntry = () => cacheEntry;

  try {
    const res = await getObservationPool({ cacheKey: 'k', params: {} });
    assert.equal(res.cacheStatus, 'hit');
    assert.equal(res.pool.taxonList.length, 1);
  } finally {
    questionCache.getEntry = originalGetEntry;
  }
});

test('getObservationPool falls back to degraded local pool when iNat is unavailable', async () => {
  questionCache.clear();
  const basePool = {
    timestamp: Date.now(),
    version: Date.now(),
    taxonList: ['11', '12', '13', '14'],
    taxonSet: new Set(['11', '12', '13', '14']),
    byTaxon: new Map([
      ['11', [{ id: 1100, taxon: { id: 11 }, photos: [{ id: 1, url: 'u1' }] }]],
      ['12', [{ id: 1200, taxon: { id: 12 }, photos: [{ id: 2, url: 'u2' }] }]],
      ['13', [{ id: 1300, taxon: { id: 13 }, photos: [{ id: 3, url: 'u3' }] }]],
      ['14', [{ id: 1400, taxon: { id: 14 }, photos: [{ id: 4, url: 'u4' }] }]],
    ]),
    observationCount: 4,
    source: 'inat',
  };
  questionCache.set('existing-pool', basePool);

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error('inat down');
  };

  try {
    const res = await getObservationPool({
      cacheKey: 'new-pool-key',
      params: { taxon_id: '11,12,13,14' },
    });
    assert.equal(res.cacheStatus, 'degrade');
    assert.equal(res.pool?.source, 'degrade-local');
    assert.ok(Array.isArray(res.pool?.taxonList));
    assert.ok(res.pool.taxonList.length >= 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
