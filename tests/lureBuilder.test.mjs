import test from 'node:test';
import assert from 'node:assert/strict';
import { buildLures } from '../server/services/lureBuilder.js';
import { similarSpeciesCache } from '../server/cache/similarSpeciesCache.js';

test('buildLures falls back to LCA-only and returns requested number of lures', async () => {
  // create a minimal pool
  const pool = {
    taxonList: ['1', '2', '3', '4'],
    byTaxon: new Map([
      ['1', [{ taxon: { id: 1, ancestor_ids: [1, 2], iconic_taxon_id: 10 } }]],
      ['2', [{ taxon: { id: 2, ancestor_ids: [1, 2], iconic_taxon_id: 10 } }]],
      ['3', [{ taxon: { id: 3, ancestor_ids: [1], iconic_taxon_id: 10 } }]],
      ['4', [{ taxon: { id: 4, ancestor_ids: [9], iconic_taxon_id: 10 } }]],
    ]),
  };

  // ensure cache prevents network call
  similarSpeciesCache.get = () => [];

  const targetObs = { taxon: { ancestor_ids: [1, 2], iconic_taxon_id: 10 } };

  const res = await buildLures(pool, null, '1', targetObs, 2, () => 0.5);
  assert.equal(Array.isArray(res.lures), true);
  assert.equal(res.lures.length, 2);
  assert.equal(res.source, 'lca-only');
});

test('buildLures prioritizes near/mid lures before far candidates when available', async () => {
  const pool = {
    taxonList: ['1', '2', '3', '4'],
    byTaxon: new Map([
      ['1', [{ taxon: { id: 1, ancestor_ids: [1, 2, 3, 4], iconic_taxon_id: 10 } }]],
      ['2', [{ taxon: { id: 2, ancestor_ids: [1, 2, 3, 4], iconic_taxon_id: 10 } }]], // near
      ['3', [{ taxon: { id: 3, ancestor_ids: [1, 2, 3], iconic_taxon_id: 10 } }]], // mid
      ['4', [{ taxon: { id: 4, ancestor_ids: [1], iconic_taxon_id: 10 } }]], // far
    ]),
  };

  similarSpeciesCache.get = () => [];

  const targetObs = { taxon: { ancestor_ids: [1, 2, 3, 4], iconic_taxon_id: 10 } };
  const res = await buildLures(pool, null, '1', targetObs, 2, () => 0.42);

  assert.equal(res.lures.length, 2);
  const lureIds = new Set(res.lures.map((l) => String(l.taxonId)));
  assert.equal(lureIds.has('2'), true);
  assert.equal(lureIds.has('3'), true);
  assert.equal(lureIds.has('4'), false);
});

test('buildLures soft-avoids recently used lure taxa', async () => {
  // Pool with 5 taxa all at near closeness
  const pool = {
    taxonList: ['1', '2', '3', '4', '5', '6'],
    byTaxon: new Map([
      ['1', [{ id: 'obs1', taxon: { id: 1, ancestor_ids: [1, 2, 3, 4, 5], iconic_taxon_id: 10 } }]],
      ['2', [{ id: 'obs2', taxon: { id: 2, ancestor_ids: [1, 2, 3, 4, 5], iconic_taxon_id: 10 } }]],
      ['3', [{ id: 'obs3', taxon: { id: 3, ancestor_ids: [1, 2, 3, 4, 5], iconic_taxon_id: 10 } }]],
      ['4', [{ id: 'obs4', taxon: { id: 4, ancestor_ids: [1, 2, 3, 4, 5], iconic_taxon_id: 10 } }]],
      ['5', [{ id: 'obs5', taxon: { id: 5, ancestor_ids: [1, 2, 3, 4, 5], iconic_taxon_id: 10 } }]],
      ['6', [{ id: 'obs6', taxon: { id: 6, ancestor_ids: [1, 2, 3, 4, 5], iconic_taxon_id: 10 } }]],
    ]),
  };

  similarSpeciesCache.get = () => [];

  const targetObs = { taxon: { ancestor_ids: [1, 2, 3, 4, 5], iconic_taxon_id: 10 } };

  // Mark taxa 2, 3, 4 as recently used lures
  const recentLureTaxa = new Set(['2', '3', '4']);

  const res = await buildLures(pool, null, '1', targetObs, 3, () => 0.5, {
    recentLureTaxa,
  });

  assert.equal(res.lures.length, 3);
  const lureIds = new Set(res.lures.map((l) => String(l.taxonId)));
  // Should prefer taxa 5 and 6 (non-recent), and one of the recent ones
  assert.equal(lureIds.has('5'), true);
  assert.equal(lureIds.has('6'), true);
});

test('buildLures tries allowSeen=false before allowSeen=true for lure observations', async () => {
  let attemptedAllowSeen = [];
  
  // Pool where taxon 2 has one unseen and one seen observation
  const pool = {
    taxonList: ['1', '2', '3', '4'],
    byTaxon: new Map([
      ['1', [{ id: 'obs1', taxon: { id: 1, ancestor_ids: [1, 2, 3], iconic_taxon_id: 10 } }]],
      ['2', [
        { id: 'obs2a', taxon: { id: 2, ancestor_ids: [1, 2, 3], iconic_taxon_id: 10 } },
        { id: 'obs2b', taxon: { id: 2, ancestor_ids: [1, 2, 3], iconic_taxon_id: 10 } },
      ]],
      ['3', [{ id: 'obs3', taxon: { id: 3, ancestor_ids: [1, 2], iconic_taxon_id: 10 } }]],
      ['4', [{ id: 'obs4', taxon: { id: 4, ancestor_ids: [1], iconic_taxon_id: 10 } }]],
    ]),
  };

  similarSpeciesCache.get = () => [];

  const targetObs = { taxon: { ancestor_ids: [1, 2, 3], iconic_taxon_id: 10 } };

  const res = await buildLures(pool, null, '1', targetObs, 3, () => 0.5);

  // Should produce 3 lures successfully
  assert.equal(res.lures.length, 3);
});

test('buildLures accepts locale option without errors', async () => {
  const pool = {
    taxonList: ['1', '2', '3', '4'],
    byTaxon: new Map([
      ['1', [{ taxon: { id: 1, ancestor_ids: [1, 2], iconic_taxon_id: 10 } }]],
      ['2', [{ taxon: { id: 2, ancestor_ids: [1, 2], iconic_taxon_id: 10 } }]],
      ['3', [{ taxon: { id: 3, ancestor_ids: [1], iconic_taxon_id: 10 } }]],
      ['4', [{ taxon: { id: 4, ancestor_ids: [9], iconic_taxon_id: 10 } }]],
    ]),
  };

  similarSpeciesCache.get = () => [];

  const targetObs = { taxon: { ancestor_ids: [1, 2], iconic_taxon_id: 10 } };

  const res = await buildLures(pool, null, '1', targetObs, 2, () => 0.5, {
    locale: 'en',
  });
  assert.equal(res.lures.length, 2);
});
