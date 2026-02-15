import test from "node:test";
import assert from "node:assert/strict";
import {
  computeScore,
  computeInGameStreakBonus,
  getLevelFromXp,
  getXpForLevel,
} from "../src/utils/scoring.js";

// Linear streak bonus: +2 per streak, cap +20
test("computeInGameStreakBonus returns linear bonus capped at 20", () => {
  assert.equal(computeInGameStreakBonus(0, "easy"), 0);
  assert.equal(computeInGameStreakBonus(1, "easy"), 2);
  assert.equal(computeInGameStreakBonus(5, "easy"), 10);
  assert.equal(computeInGameStreakBonus(10, "easy"), 20);  // cap
  assert.equal(computeInGameStreakBonus(15, "easy"), 20);  // still capped
  
  // Same for hard mode (mode param no longer matters)
  assert.equal(computeInGameStreakBonus(1, "hard"), 2);
  assert.equal(computeInGameStreakBonus(10, "hard"), 20);
  assert.equal(computeInGameStreakBonus(20, "hard"), 20);
});

// FIX #6: Test edge cases for level/XP functions
test("getLevelFromXp handles edge cases correctly", () => {
  // Normal cases
  assert.equal(getLevelFromXp(0), 1);
  assert.equal(getLevelFromXp(100), 2);
  assert.equal(getLevelFromXp(1600), 5);
  
  // FIX #6: Edge cases
  assert.equal(getLevelFromXp(-100), 1); // Negative XP should return level 1
  assert.equal(getLevelFromXp(NaN), 1); // NaN should return level 1
  assert.equal(getLevelFromXp(undefined), 1); // undefined should return level 1
  assert.equal(getLevelFromXp(null), 1); // null should return level 1
  // Infinity is treated as invalid and returns level 1 (safe default)
  assert.equal(getLevelFromXp(Infinity), 1);
});

test("getXpForLevel handles edge cases correctly", () => {
  // Normal cases
  assert.equal(getXpForLevel(1), 0);
  assert.equal(getXpForLevel(2), 100);
  assert.equal(getXpForLevel(5), 1600);
  assert.equal(getXpForLevel(10), 8100);
  
  // FIX #6: Edge cases
  assert.equal(getXpForLevel(0), 0); // Level 0 should return 0
  assert.equal(getXpForLevel(-5), 0); // Negative level should return 0
  assert.equal(getXpForLevel(NaN), 0); // NaN should return 0
  assert.equal(getXpForLevel(undefined), 0); // undefined should return 0
  assert.equal(getXpForLevel(null), 0); // null should return 0
});

// Test that level functions are inverse of each other
test("getLevelFromXp and getXpForLevel are inverse functions", () => {
  // For any level, getXpForLevel(level) should give XP that maps back to level
  for (let level = 1; level <= 20; level++) {
    const xpNeeded = getXpForLevel(level);
    const calculatedLevel = getLevelFromXp(xpNeeded);
    
    // Should return the same level or the level just below (due to floor)
    assert.ok(
      calculatedLevel === level || calculatedLevel === level - 1,
      `Level ${level}: XP ${xpNeeded} maps to level ${calculatedLevel}`
    );
  }
});

// Test computeScore basic functionality
test("computeScore returns correct values for easy mode", () => {
  const correct = computeScore({ mode: "easy", isCorrect: true });
  assert.equal(correct.points, 10);
  assert.equal(correct.bonus, 0);
  
  const incorrect = computeScore({ mode: "easy", isCorrect: false });
  assert.equal(incorrect.points, 0);
  assert.equal(incorrect.bonus, 0);
});

test("computeScore returns correct values for hard mode", () => {
  const correct = computeScore({
    mode: "hard",
    isCorrect: true,
    basePoints: 25,
    guessesRemaining: 3,
  });
  assert.equal(correct.points, 25);
  assert.equal(correct.bonus, 30); // 3 * 10 (rebalanced HARD_GUESS_BONUS)
  
  const incorrect = computeScore({
    mode: "hard",
    isCorrect: false,
    basePoints: 25,
    guessesRemaining: 3,
  });
  assert.equal(incorrect.points, 0);
  assert.equal(incorrect.bonus, 0); // No bonus when incorrect
});

// Test XP accumulation with linear streak
test("XP accumulation with linear streak is predictable", () => {
  let totalXP = 0;
  
  for (let round = 1; round <= 10; round++) {
    const basePoints = 10; // Easy mode
    const streakBonus = computeInGameStreakBonus(round, "easy");
    totalXP += basePoints + streakBonus;
  }
  
  // 10 rounds: base 10 each = 100
  // streak: 2+4+6+8+10+12+14+16+18+20 = 110
  // total = 210
  assert.equal(totalXP, 210);
});
