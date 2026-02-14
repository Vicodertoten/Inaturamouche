import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeHintXpMultiplier,
  computeTaxonRepeatMultiplier,
  computeRoundEconomy,
} from '../src/utils/economy.js';

test('computeHintXpMultiplier uses no penalty for riddle mode', () => {
  assert.equal(computeHintXpMultiplier({ mode: 'riddle', hintCount: 0 }), 1);
  assert.equal(computeHintXpMultiplier({ mode: 'riddle', hintCount: 2 }), 1);
});

test('computeTaxonRepeatMultiplier applies diminishing returns', () => {
  assert.equal(computeTaxonRepeatMultiplier(0), 1);
  assert.equal(computeTaxonRepeatMultiplier(1), 0.85);
  assert.equal(computeTaxonRepeatMultiplier(2), 0.7);
  assert.equal(computeTaxonRepeatMultiplier(99), 0.6);
});

test('computeRoundEconomy produces deterministic score/xp breakdown', () => {
  const result = computeRoundEconomy({
    isCorrect: true,
    points: 20,
    bonus: 5,
    streakBonus: 10,
    rarityBonusXp: 3,
    mode: 'hard',
    hintCount: 1,
    repeatCount: 1,
  });

  assert.equal(result.scoreDelta, 35);
  assert.equal(result.baseXp, 38);
  assert.equal(result.hintXpMultiplier, 0.85);
  assert.equal(result.repeatXpMultiplier, 0.85);
  assert.equal(result.xpBeforeProfileMultipliers, 27);
});

