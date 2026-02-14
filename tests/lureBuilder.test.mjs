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
