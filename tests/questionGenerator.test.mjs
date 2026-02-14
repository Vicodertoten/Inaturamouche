import test from 'node:test';
import assert from 'node:assert/strict';
import { buildUniqueEasyChoicePairs } from '../server/services/questionGenerator.js';

test('buildUniqueEasyChoicePairs keeps labels unique when common names collide', () => {
  const details = new Map([
    ['1', { id: 1, preferred_common_name: 'Rouge-gorge', name: 'Erithacus rubecula' }],
    ['2', { id: 2, preferred_common_name: 'Rouge-gorge', name: 'Petroica goodenovii' }],
    ['3', { id: 3, preferred_common_name: 'Merle', name: 'Turdus merula' }],
    ['4', { id: 4, preferred_common_name: 'Rouge-gorge', name: 'Cossypha heuglini' }],
  ]);

  const pairs = buildUniqueEasyChoicePairs(details, ['1', '2', '3', '4']);
  const labels = pairs.map((entry) => entry.label.toLowerCase());

  assert.equal(pairs.length, 4);
  assert.equal(new Set(labels).size, 4);
});

test('buildUniqueEasyChoicePairs keeps stable id mapping', () => {
  const details = new Map([
    ['1', { id: 1, preferred_common_name: 'Abeille', name: 'Apis mellifera' }],
    ['2', { id: 2, preferred_common_name: 'Abeille', name: 'Apis cerana' }],
  ]);

  const pairs = buildUniqueEasyChoicePairs(details, ['1', '2']);

  assert.deepEqual(
    pairs.map((entry) => entry.taxon_id),
    ['1', '2']
  );
  assert.notEqual(pairs[0].label, pairs[1].label);
});
