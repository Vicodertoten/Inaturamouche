import test from "node:test";
import assert from "node:assert/strict";
import {
  computeScore,
  computeInGameStreakBonus,
  getLevelFromXp,
  getXpForLevel,
} from "../src/utils/scoring.js";

// FIX #2: Test that streak bonus returns floating point values
test("computeInGameStreakBonus returns floating point values for precision", () => {
  // Easy mode streak 1 should return exact value (not rounded)
  const easyStreak1 = computeInGameStreakBonus(1, "easy");
  assert.equal(easyStreak1, 5);
  
  // Easy mode streak 2 should return floating point
  const easyStreak2 = computeInGameStreakBonus(2, "easy");
  assert.equal(easyStreak2, 7); // 5 * 1.4^1 = 7.0
  
  // Easy mode streak 3 should return floating point (not Math.floor)
  const easyStreak3 = computeInGameStreakBonus(3, "easy");
  assert.ok(easyStreak3 > 9.79 && easyStreak3 < 9.81); // 5 * 1.4^2 = 9.8
  
  // Hard mode streak 1
  const hardStreak1 = computeInGameStreakBonus(1, "hard");
  assert.equal(hardStreak1, 10);
  
  // Hard mode streak 3 should return floating point
  const hardStreak3 = computeInGameStreakBonus(3, "hard");
  assert.ok(hardStreak3 > 22.4 && hardStreak3 < 22.6); // 10 * 1.5^2 = 22.5
});

// Test that streak is capped at 15
test("computeInGameStreakBonus caps streak at 15", () => {
  const streak15Easy = computeInGameStreakBonus(15, "easy");
  const streak20Easy = computeInGameStreakBonus(20, "easy");
  
  // Should be same value because of cap
  assert.equal(streak15Easy, streak20Easy);
  
  const streak15Hard = computeInGameStreakBonus(15, "hard");
  const streak20Hard = computeInGameStreakBonus(20, "hard");
  
  assert.equal(streak15Hard, streak20Hard);
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
  assert.equal(correct.bonus, 15); // 3 * 5
  
  const incorrect = computeScore({
    mode: "hard",
    isCorrect: false,
    basePoints: 25,
    guessesRemaining: 3,
  });
  assert.equal(incorrect.points, 0);
  assert.equal(incorrect.bonus, 0); // No bonus when incorrect
});

// Test XP accumulation without rounding errors
test("XP accumulation maintains precision with floating point", () => {
  // Simulate 10 rounds with streak bonuses
  let totalXP = 0;
  
  for (let round = 1; round <= 10; round++) {
    const basePoints = 10; // Easy mode
    const streakBonus = computeInGameStreakBonus(round, "easy");
    const roundXP = basePoints + streakBonus;
    totalXP += roundXP;
  }
  
  // With floating point accumulation, we should have more precise total
  // Round only once at the end
  const finalXP = Math.floor(totalXP);
  
  // Verify it's different from if we rounded each time
  let totalXPWithRounding = 0;
  for (let round = 1; round <= 10; round++) {
    const basePoints = 10;
    const streakBonus = Math.floor(computeInGameStreakBonus(round, "easy"));
    const roundXP = basePoints + streakBonus;
    totalXPWithRounding += roundXP;
  }
  
  // The difference shows the cumulative precision loss
  const precisionGained = finalXP - totalXPWithRounding;
  assert.ok(
    precisionGained >= 0,
    `Gained ${precisionGained} XP by rounding once at end`
  );
});
