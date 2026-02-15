import test from 'node:test';
import assert from 'node:assert/strict';
import { buildLures } from '../server/services/lureBuilder.js';

// Helper: build a pool with a pre-computed confusion map
function makePool(taxonEntries, confusionMapData = null) {
  const taxonList = taxonEntries.map(([id]) => String(id));
  const byTaxon = new Map(taxonEntries.map(([id, obs]) => [String(id), obs]));
  const confusionMap = confusionMapData ? new Map(
    Object.entries(confusionMapData).map(([k, v]) => [String(k), v])
  ) : null;
  return { taxonList, byTaxon, confusionMap };
}

test('buildLures uses confusion map and returns requested number of lures', () => {
  const pool = makePool(
    [
      ['1', [{ taxon: { id: 1, ancestor_ids: [1, 2], iconic_taxon_id: 10 } }]],
      ['2', [{ taxon: { id: 2, ancestor_ids: [1, 2], iconic_taxon_id: 10 } }]],
      ['3', [{ taxon: { id: 3, ancestor_ids: [1], iconic_taxon_id: 10 } }]],
      ['4', [{ taxon: { id: 4, ancestor_ids: [9], iconic_taxon_id: 10 } }]],
    ],
    {
      '1': [
        { tid: '2', score: 0.95, closeness: 0.95, source: 'similar+lca' },
        { tid: '3', score: 0.70, closeness: 0.70, source: 'lca' },
        { tid: '4', score: 0.30, closeness: 0.30, source: 'lca' },
      ],
    }
  );
  const targetObs = { taxon: { ancestor_ids: [1, 2], iconic_taxon_id: 10 } };

  const res = buildLures(pool, null, '1', targetObs, 2, () => 0.5);
  assert.equal(Array.isArray(res.lures), true);
  assert.equal(res.lures.length, 2);
  assert.equal(res.source, 'confusion-map');
});

test('buildLures falls back to LCA scoring when no confusion map', () => {
  const pool = makePool([
    ['1', [{ taxon: { id: 1, ancestor_ids: [1, 2], iconic_taxon_id: 10 } }]],
    ['2', [{ taxon: { id: 2, ancestor_ids: [1, 2], iconic_taxon_id: 10 } }]],
    ['3', [{ taxon: { id: 3, ancestor_ids: [1], iconic_taxon_id: 10 } }]],
    ['4', [{ taxon: { id: 4, ancestor_ids: [9], iconic_taxon_id: 10 } }]],
  ]);
  const targetObs = { taxon: { ancestor_ids: [1, 2], iconic_taxon_id: 10 } };

  const res = buildLures(pool, null, '1', targetObs, 2, () => 0.5);
  assert.equal(res.lures.length, 2);
  assert.equal(res.source, 'lca-fallback');
});

test('buildLures weighted selection favors less-used lures', () => {
  // With 5 candidates, track usage to bias selection
  const pool = makePool(
    [
      ['1', [{ id: 'obs1', taxon: { id: 1, ancestor_ids: [1, 2, 3, 4, 5], iconic_taxon_id: 10 } }]],
      ['2', [{ id: 'obs2', taxon: { id: 2, ancestor_ids: [1, 2, 3, 4, 5], iconic_taxon_id: 10 } }]],
      ['3', [{ id: 'obs3', taxon: { id: 3, ancestor_ids: [1, 2, 3, 4, 5], iconic_taxon_id: 10 } }]],
      ['4', [{ id: 'obs4', taxon: { id: 4, ancestor_ids: [1, 2, 3, 4, 5], iconic_taxon_id: 10 } }]],
      ['5', [{ id: 'obs5', taxon: { id: 5, ancestor_ids: [1, 2, 3, 4, 5], iconic_taxon_id: 10 } }]],
      ['6', [{ id: 'obs6', taxon: { id: 6, ancestor_ids: [1, 2, 3, 4, 5], iconic_taxon_id: 10 } }]],
    ],
    {
      '1': [
        { tid: '2', score: 0.9, closeness: 0.9, source: 'lca' },
        { tid: '3', score: 0.9, closeness: 0.9, source: 'lca' },
        { tid: '4', score: 0.9, closeness: 0.9, source: 'lca' },
        { tid: '5', score: 0.9, closeness: 0.9, source: 'lca' },
        { tid: '6', score: 0.9, closeness: 0.9, source: 'lca' },
      ],
    }
  );
  const targetObs = { taxon: { ancestor_ids: [1, 2, 3, 4, 5], iconic_taxon_id: 10 } };

  // Lure taxa 2, 3, 4 have been used many times
  const lureUsageCount = new Map([['2', 10], ['3', 10], ['4', 10]]);

  const res = buildLures(pool, null, '1', targetObs, 3, () => 0.5, {
    lureUsageCount,
  });

  assert.equal(res.lures.length, 3);
  const lureIds = new Set(res.lures.map((l) => String(l.taxonId)));
  // 5 and 6 should be strongly preferred (never used) over 2, 3, 4 (used 10x)
  assert.equal(lureIds.has('5'), true, 'Unused lure 5 should be picked');
  assert.equal(lureIds.has('6'), true, 'Unused lure 6 should be picked');
});

test('buildLures respects minCloseness filter', () => {
  const pool = makePool(
    [
      ['1', [{ taxon: { id: 1, ancestor_ids: [1, 2, 3, 4], iconic_taxon_id: 10 } }]],
      ['2', [{ taxon: { id: 2, ancestor_ids: [1, 2, 3, 4], iconic_taxon_id: 10 } }]],
      ['3', [{ taxon: { id: 3, ancestor_ids: [1, 2, 3], iconic_taxon_id: 10 } }]],
      ['4', [{ taxon: { id: 4, ancestor_ids: [1], iconic_taxon_id: 10 } }]],
    ],
    {
      '1': [
        { tid: '2', score: 0.95, closeness: 0.95, source: 'lca' },
        { tid: '3', score: 0.75, closeness: 0.75, source: 'lca' },
        { tid: '4', score: 0.25, closeness: 0.25, source: 'lca' },
      ],
    }
  );
  const targetObs = { taxon: { ancestor_ids: [1, 2, 3, 4], iconic_taxon_id: 10 } };

  // With high minCloseness, only taxon 2 should qualify
  const res = buildLures(pool, null, '1', targetObs, 3, () => 0.5, {
    minCloseness: 0.9,
  });

  assert.equal(res.lures.length, 1);
  assert.equal(res.lures[0].taxonId, '2');
});

test('buildLures uses external observations from confusion map', () => {
  const externalObs = {
    id: 999,
    photos: [{ url: 'https://example.com/photo.jpg' }],
    taxon: { id: 99, ancestor_ids: [1, 2, 3], iconic_taxon_id: 10, name: 'External sp.' },
  };

  const pool = makePool(
    [
      ['1', [{ taxon: { id: 1, ancestor_ids: [1, 2], iconic_taxon_id: 10 } }]],
      ['2', [{ taxon: { id: 2, ancestor_ids: [1, 2], iconic_taxon_id: 10 } }]],
    ],
    {
      '1': [
        { tid: '2', score: 0.90, closeness: 0.90, source: 'lca' },
        { tid: '99', score: 0.85, closeness: 0.70, source: 'external-similar', obs: externalObs },
      ],
    }
  );
  const targetObs = { taxon: { ancestor_ids: [1, 2], iconic_taxon_id: 10 } };

  const res = buildLures(pool, null, '1', targetObs, 2, () => 0.5);
  assert.equal(res.lures.length, 2);

  const externalLure = res.lures.find((l) => l.taxonId === '99');
  assert.ok(externalLure, 'External lure from confusion map should be included');
  assert.equal(externalLure.obs.taxon.name, 'External sp.');
});
