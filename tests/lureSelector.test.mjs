import test from 'node:test';
import assert from 'node:assert/strict';
import { selectLureCandidates } from '../server/services/lures-v2/Selector.js';

const policyEasy = {
  minCloseness: 0.8,
  closeThreshold: 0.9,
  midThreshold: 0.75,
  composition: [
    { bucket: 'close', count: 2 },
    { bucket: 'mid', count: 1 },
  ],
};

test('selector builds close-heavy composition for easy profile', () => {
  const candidates = [
    { tid: '2', score: 0.95, closeness: 0.95, source: 'confusion-map' },
    { tid: '3', score: 0.92, closeness: 0.93, source: 'confusion-map' },
    { tid: '4', score: 0.85, closeness: 0.81, source: 'confusion-map' },
    { tid: '5', score: 0.74, closeness: 0.76, source: 'confusion-map' },
  ];

  const result = selectLureCandidates({
    candidates,
    lureCount: 3,
    policy: policyEasy,
    excludeTaxonIds: new Set(),
    lureUsageCount: new Map(),
    rng: () => 0.5,
  });

  assert.equal(result.selected.length, 3);
  const selectedIds = new Set(result.selected.map((candidate) => candidate.tid));
  assert.equal(selectedIds.has('2'), true);
  assert.equal(selectedIds.has('3'), true);
});

test('selector respects exclusion set', () => {
  const candidates = [
    { tid: '2', score: 0.95, closeness: 0.95, source: 'confusion-map' },
    { tid: '3', score: 0.92, closeness: 0.93, source: 'confusion-map' },
    { tid: '4', score: 0.85, closeness: 0.81, source: 'confusion-map' },
    { tid: '5', score: 0.74, closeness: 0.76, source: 'confusion-map' },
  ];

  const result = selectLureCandidates({
    candidates,
    lureCount: 3,
    policy: policyEasy,
    excludeTaxonIds: new Set(['2']),
    lureUsageCount: new Map(),
    rng: () => 0.5,
  });

  assert.equal(result.selected.length, 3);
  const selectedIds = result.selected.map((candidate) => candidate.tid);
  assert.equal(selectedIds.includes('2'), false);
});
