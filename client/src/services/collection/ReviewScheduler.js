// client/src/services/collection/ReviewScheduler.js
// Spaced Repetition System (SRS) — review scheduling and statistics.

import { stats as statsTable, taxa as taxaTable } from '../db.js';

// ============== SRS ALGORITHM ==============

/**
 * Calculate the next review date based on Spaced Repetition algorithm.
 * First encounter → review in 1 day
 * Correct answer → double interval (max 90 days)
 * Wrong answer → reset to 1 day
 * @param {Object} existing - Existing stats object
 * @param {boolean} isCorrect
 * @param {string} now - Current timestamp (ISO string)
 * @returns {string} Next review date (ISO string)
 */
export function calculateNextReviewDate(existing, isCorrect, now) {
  const currentDate = new Date(now);

  if (!existing) {
    const nextDate = new Date(currentDate);
    nextDate.setDate(nextDate.getDate() + 1);
    return nextDate.toISOString();
  }

  const currentInterval = existing.reviewInterval || 1;
  const newInterval = isCorrect ? Math.min(currentInterval * 2, 90) : 1;

  const nextDate = new Date(currentDate);
  nextDate.setDate(nextDate.getDate() + newInterval);
  return nextDate.toISOString();
}

/**
 * Calculate the review interval in days.
 * @param {Object} existing
 * @param {boolean} isCorrect
 * @returns {number}
 */
export function calculateReviewInterval(existing, isCorrect) {
  if (!existing) return 1;
  const current = existing.reviewInterval || 1;
  return isCorrect ? Math.min(current * 2, 90) : 1;
}

/**
 * Calculate ease factor (inspired by Anki algorithm).
 * @param {Object} existing
 * @param {boolean} isCorrect
 * @returns {number} Ease factor (1.3 – 3.0)
 */
export function calculateEaseFactor(existing, isCorrect) {
  const currentEase = existing?.easeFactor || 2.5;
  if (isCorrect) {
    return Math.min(currentEase + 0.1, 3.0);
  }
  return Math.max(currentEase - 0.2, 1.3);
}

// ============== QUERIES ==============

/**
 * Get species that are due for review.
 * @param {number} limit
 * @returns {Promise<Array<{stat, taxon}>>}
 */
export async function getSpeciesDueForReview(limit = 10) {
  try {
    const now = new Date();
    const allStats = await statsTable.toArray();

    const dueForReview = allStats.filter((stat) => {
      if (!stat.nextReviewDate) return false;
      return new Date(stat.nextReviewDate) <= now;
    });

    dueForReview.sort((a, b) => {
      if (a.reviewInterval !== b.reviewInterval) {
        return a.reviewInterval - b.reviewInterval;
      }
      return new Date(a.lastSeenAt) - new Date(b.lastSeenAt);
    });

    const selected = dueForReview.slice(0, limit);

    const enriched = await Promise.all(
      selected.map(async (stat) => {
        const taxon = await taxaTable.get(stat.id);
        return { stat, taxon };
      }),
    );

    return enriched.filter((item) => item.taxon);
  } catch (error) {
    console.error('Failed to get species due for review:', error);
    return [];
  }
}

/**
 * Get review system statistics.
 * @returns {Promise<{dueToday, dueTomorrow, totalInReviewSystem}>}
 */
export async function getReviewStats() {
  try {
    const now = new Date();
    const allStats = await statsTable.toArray();

    const dueToday = allStats.filter((stat) => {
      if (!stat.nextReviewDate) return false;
      return new Date(stat.nextReviewDate) <= now;
    }).length;

    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(23, 59, 59, 999);

    const dueTomorrow = allStats.filter((stat) => {
      if (!stat.nextReviewDate) return false;
      const reviewDate = new Date(stat.nextReviewDate);
      return reviewDate > now && reviewDate <= tomorrow;
    }).length;

    const totalInReviewSystem = allStats.filter((stat) => stat.nextReviewDate).length;

    return { dueToday, dueTomorrow, totalInReviewSystem };
  } catch (error) {
    console.error('Failed to get review stats:', error);
    return { dueToday: 0, dueTomorrow: 0, totalInReviewSystem: 0 };
  }
}
