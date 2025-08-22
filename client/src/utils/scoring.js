export const EASY_BASE_POINTS = 10;
export const HARD_GUESS_BONUS = 5;

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

export default computeScore;
