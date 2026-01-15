export const EASY_BASE_POINTS = 10;
export const HARD_GUESS_BONUS = 5;
export const MASTERY_THRESHOLD = 3;

/**
 * Compute score and bonus for a round depending on game mode.
 * @param {Object} params
 * @param {'easy'|'hard'} params.mode - Game mode.
 * @param {boolean} [params.isCorrect=false] - Whether the question was answered correctly.
 * @param {number} [params.basePoints=0] - Base points earned in the round (used in hard mode).
 * @param {number} [params.guessesRemaining=0] - Remaining guesses (used in hard mode for bonus).
 * @returns {{points: number, bonus: number}}
 */
export function computeScore({
  mode,
  isCorrect = false,
  basePoints = 0,
  guessesRemaining = 0
}) {
  let points = 0;
  let bonus = 0;

  if (mode === 'easy') {
    points = isCorrect ? EASY_BASE_POINTS : 0;
  } else if (mode === 'hard') {
    points = basePoints;
    if (isCorrect) {
      bonus = guessesRemaining * HARD_GUESS_BONUS;
    }
  }

  return { points, bonus };
}

/**
 * Compute exponential in-game streak bonus points.
 * Encourages long streaks with increasing rewards.
 * 
 * @param {number} streak - Current streak value
 * @param {'easy'|'hard'} mode - Game mode
 * @returns {number} Bonus points for the streak
 */
export function computeInGameStreakBonus(streak, mode) {
  if (streak === 0) return 0;

  // Cap streak at 15 to prevent extreme values
  const cappedStreak = Math.min(streak, 15);

  if (mode === 'easy') {
    // Formula: 5 * 1.4^(streak-1)
    // Streak 1:   5 pts
    // Streak 3:  10 pts
    // Streak 5:  19 pts
    // Streak 10: 77 pts
    // Streak 15: 289 pts
    return Math.floor(5 * Math.pow(1.4, cappedStreak - 1));
  }

  if (mode === 'hard') {
    // Formula: 10 * 1.5^(streak-1)
    // Streak 1:  10 pts
    // Streak 3:  23 pts
    // Streak 5:  51 pts
    // Streak 10: 383 pts
    // Streak 15: 2176 pts
    return Math.floor(10 * Math.pow(1.5, cappedStreak - 1));
  }

  return 0;
}

export const getLevelFromXp = (xp) => 1 + Math.floor(Math.sqrt(xp || 0) / 10);

export const getXpForLevel = (level) => {
  if (level <= 1) return 0;
  return Math.pow((level - 1) * 10, 2);
};

export default computeScore;
