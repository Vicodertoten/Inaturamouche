import test from 'node:test';
import assert from 'node:assert';
import { computeScore } from './scoring.js';

// Tests for easy mode

test('easy mode correct answer', () => {
  const result = computeScore({ mode: 'easy', isCorrect: true });
  assert.strictEqual(result.points, 10);
  assert.strictEqual(result.bonus, 0);
});

test('easy mode incorrect answer', () => {
  const result = computeScore({ mode: 'easy', isCorrect: false });
  assert.strictEqual(result.points, 0);
  assert.strictEqual(result.bonus, 0);
});

// Tests for hard mode

test('hard mode species guessed with remaining guesses', () => {
  const result = computeScore({ mode: 'hard', basePoints: 25, guessesRemaining: 3, isCorrect: true });
  assert.strictEqual(result.points, 25);
  assert.strictEqual(result.bonus, 15);
});

test('hard mode lost round', () => {
  const result = computeScore({ mode: 'hard', basePoints: 10, guessesRemaining: 0, isCorrect: false });
  assert.strictEqual(result.points, 0);
  assert.strictEqual(result.bonus, 0);
});
