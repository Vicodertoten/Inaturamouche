import test from 'node:test';
import assert from 'node:assert/strict';
import { getDifficultyPolicy } from '../server/services/lures-v2/DifficultyPolicy.js';

test('getDifficultyPolicy returns harder defaults for riddle than easy', () => {
  const easy = getDifficultyPolicy('easy');
  const riddle = getDifficultyPolicy('riddle');

  assert.equal(easy.mode, 'easy');
  assert.equal(riddle.mode, 'riddle');
  assert.equal(riddle.minCloseness >= easy.minCloseness, true);
  assert.deepEqual(riddle.composition, [{ bucket: 'close', count: 3 }]);
});

test('getDifficultyPolicy applies minCloseness override', () => {
  const policy = getDifficultyPolicy('easy', { minClosenessOverride: 0.91 });
  assert.equal(policy.minCloseness, 0.91);
});
