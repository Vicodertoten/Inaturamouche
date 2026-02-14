/**
 * Daily Challenge utilities.
 *
 * Tracks whether the user has already completed (or is mid‐game) today's
 * daily challenge so we can enforce the "1 chance per day" rule.
 *
 * Storage key in localStorage:
 *   - DAILY_COMPLETED_KEY  → the seed string (YYYY-MM-DD) of the last completed daily challenge
 */

const DAILY_COMPLETED_KEY = 'daily_challenge_completed_seed';

/**
 * Return today's daily seed string (UTC).
 */
export function getTodayDailySeed() {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const day = String(now.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Mark a daily seed as completed.
 */
export function markDailyCompleted(seed) {
  try {
    localStorage.setItem(DAILY_COMPLETED_KEY, seed);
  } catch {
    // localStorage unavailable — silently ignore
  }
}

/**
 * Check whether a given daily seed has already been completed.
 */
export function isDailyCompleted(seed) {
  try {
    return localStorage.getItem(DAILY_COMPLETED_KEY) === seed;
  } catch {
    return false;
  }
}

/**
 * Check whether a saved session's daily seed is still valid (matches today).
 * Returns `true` when the seed is stale and should be discarded.
 */
export function isDailySeedStale(seed) {
  if (!seed) return false;
  return seed !== getTodayDailySeed();
}
