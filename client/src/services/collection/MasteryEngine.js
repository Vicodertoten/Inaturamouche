// client/src/services/collection/MasteryEngine.js
// Mastery constants, XP thresholds, and mastery-level calculation.

// ============== MASTERY CONSTANTS ==============

export const MASTERY_LEVELS = Object.freeze({
  NONE: 0,
  BRONZE: 1,    // Discovery
  SILVER: 2,    // Familiar
  GOLD: 3,      // Expert
  DIAMOND: 4,   // Master (Reserved for Hard Mode)
});

export const MASTERY_NAMES = Object.freeze({
  0: 'Unseen',
  1: 'Bronze',
  2: 'Silver',
  3: 'Gold',
  4: 'Diamond',
});

// --------- XP-based mastery system ---------
export const XP_GAINS = Object.freeze({
  CORRECT: 10,
  WRONG: -5,
});

export const MASTERY_XP_THRESHOLDS = Object.freeze({
  [MASTERY_LEVELS.BRONZE]: 10,
  [MASTERY_LEVELS.SILVER]: 50,
  [MASTERY_LEVELS.GOLD]: 120,
  [MASTERY_LEVELS.DIAMOND]: 300,
});

/**
 * Calculate mastery level based on accumulated XP.
 * @param {number} xp
 * @returns {number} MASTERY_LEVELS value
 */
export function calculateMasteryLevel(xp = 0) {
  if (!xp || xp <= 0) return MASTERY_LEVELS.NONE;
  if (xp >= MASTERY_XP_THRESHOLDS[MASTERY_LEVELS.DIAMOND]) return MASTERY_LEVELS.DIAMOND;
  if (xp >= MASTERY_XP_THRESHOLDS[MASTERY_LEVELS.GOLD]) return MASTERY_LEVELS.GOLD;
  if (xp >= MASTERY_XP_THRESHOLDS[MASTERY_LEVELS.SILVER]) return MASTERY_LEVELS.SILVER;
  if (xp >= MASTERY_XP_THRESHOLDS[MASTERY_LEVELS.BRONZE]) return MASTERY_LEVELS.BRONZE;
  return MASTERY_LEVELS.NONE;
}
