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
  questionCache.getEntry = () => cacheEntry;

  const res = await getObservationPool({ cacheKey: 'k', params: {} });
  assert.equal(res.cacheStatus, 'hit');
  assert.equal(res.pool.taxonList.length, 1);
});
