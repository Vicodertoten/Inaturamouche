import test from 'node:test';
import assert from 'node:assert/strict';
import { computeRoundEconomy } from '../src/utils/economy.js';

test('computeRoundEconomy produces deterministic score/xp breakdown', () => {
  const result = computeRoundEconomy({
    isCorrect: true,
    points: 20,
    bonus: 5,
    streakBonus: 10,
    rarityBonusXp: 3,
  });

  assert.equal(result.scoreDelta, 35);        // 20 + 5 + 10
  assert.equal(result.baseXp, 25);             // 20 + 5 (points + bonus, no streak)
  assert.equal(result.streakBonus, 10);
  assert.equal(result.rarityBonus, 3);
  assert.equal(result.xp, 38);                 // 35 + 3 = 38
});

test('computeRoundEconomy returns 0 xp for incorrect answer', () => {
  const result = computeRoundEconomy({
    isCorrect: false,
    points: 0,
    bonus: 0,
    streakBonus: 0,
    rarityBonusXp: 5,
  });

  assert.equal(result.scoreDelta, 0);
  assert.equal(result.xp, 0);
  assert.equal(result.rarityBonus, 0);
});

