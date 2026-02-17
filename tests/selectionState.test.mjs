import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createSelectionState,
  pushLureCooldown,
  buildLureCooldownExclusionSet,
} from '../server/services/selectionState.js';

function makePool(ids) {
  const taxonList = ids.map(String);
  return {
    taxonList,
    taxonSet: new Set(taxonList),
    observationCount: taxonList.length * 2,
    version: 1,
  };
}

test('lure cooldown keeps only recent taxa up to effective limit', () => {
  const pool = makePool(['1', '2', '3', '4', '5', '6', '7', '8']);
  const state = createSelectionState(pool);

  pushLureCooldown(pool, state, ['1', '2', '3', '4', '5', '6']);

  // Effective limit = min(COOLDOWN_LURE_N=6, taxonListLen-quizChoices=4)
  assert.equal(state.recentLureTaxa.length, 4);
  assert.deepEqual(state.recentLureTaxa, ['6', '5', '4', '3']);
  const exclusion = buildLureCooldownExclusionSet(pool, state);
  assert.deepEqual(Array.from(exclusion).sort(), ['3', '4', '5', '6']);
});

test('lure cooldown exclusion is filtered by current pool taxa', () => {
  const fullPool = makePool(['1', '2', '3', '4', '5', '6', '7', '8']);
  const state = createSelectionState(fullPool);
  pushLureCooldown(fullPool, state, ['3', '4', '5', '6']);

  const narrowedPool = makePool(['1', '2', '3', '4', '7', '8', '9']);
  const exclusion = buildLureCooldownExclusionSet(narrowedPool, state);

  assert.deepEqual(Array.from(exclusion).sort(), ['3', '4']);
  assert.deepEqual(state.recentLureTaxa.sort(), ['3', '4']);
});
