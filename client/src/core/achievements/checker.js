/**
 * utils/achievementChecker.js
 * Utilities for checking and unlocking streak-related achievements
 */

/**
 * Check and unlock streak achievements based on player profile
 * @param {Object} profile - Player profile with stats and achievements
 * @returns {Array<string>} Array of newly unlocked achievement IDs
 */
export const checkStreakAchievements = (profile) => {
  const newAchievements = [];
  if (!profile) return newAchievements;

  const longestStreak = profile.stats?.longestStreak || 0;
  const achievements = new Set(profile.achievements || []);

  // Check STREAK_STARTER_3
  if (longestStreak >= 3 && !achievements.has('STREAK_STARTER_3')) {
    newAchievements.push('STREAK_STARTER_3');
  }

  // Check STREAK_MASTER_5
  if (longestStreak >= 5 && !achievements.has('STREAK_MASTER_5')) {
    newAchievements.push('STREAK_MASTER_5');
  }

  // Check STREAK_LEGEND_10
  if (longestStreak >= 10 && !achievements.has('STREAK_LEGEND_10')) {
    newAchievements.push('STREAK_LEGEND_10');
  }

  // Check STREAK_TITAN_20
  if (longestStreak >= 20 && !achievements.has('STREAK_TITAN_20')) {
    newAchievements.push('STREAK_TITAN_20');
  }

  // Check STREAK_GUARDIAN (ultimate achievement)
  if (longestStreak >= 50 && !achievements.has('STREAK_GUARDIAN')) {
    newAchievements.push('STREAK_GUARDIAN');
  }

  return newAchievements;
};

/**
 * Check perfect game achievements based on session data
 * @param {Object} sessionData - Session statistics
 * @returns {Array<string>} Array of newly unlocked achievement IDs
 */
export const checkPerfectGameAchievements = (sessionData) => {
  const newAchievements = [];
  if (!sessionData) return newAchievements;

  const {
    totalQuestions = 0,
    correctAnswers = 0,
    shieldsUsed = 0,
    gameMode = 'easy',
    achievements = [],
  } = sessionData;

  const achievementSet = new Set(achievements || []);

  // Check PERFECT_GAME: 5 questions without error or shield
  if (
    totalQuestions >= 5 &&
    correctAnswers === totalQuestions &&
    shieldsUsed === 0 &&
    !achievementSet.has('PERFECT_GAME')
  ) {
    newAchievements.push('PERFECT_GAME');
  }

  // Check FLAWLESS_HARD: 10 hard mode questions without error or shield
  if (
    gameMode === 'hard' &&
    totalQuestions >= 10 &&
    correctAnswers === totalQuestions &&
    shieldsUsed === 0 &&
    !achievementSet.has('FLAWLESS_HARD')
  ) {
    newAchievements.push('FLAWLESS_HARD');
  }

  return newAchievements;
};

/**
 * Combine all achievement checks for a session
 * @param {Object} profile - Player profile
 * @param {Object} sessionData - Session statistics
 * @returns {Array<string>} Array of all newly unlocked achievement IDs
 */
export const checkAllAchievements = (profile, sessionData = {}) => {
  const unlocked = new Set();

  const streakAchievements = checkStreakAchievements(profile);
  streakAchievements.forEach((id) => unlocked.add(id));

  const perfectGameAchievements = checkPerfectGameAchievements({
    ...sessionData,
    achievements: profile?.achievements || [],
  });
  perfectGameAchievements.forEach((id) => unlocked.add(id));

  return Array.from(unlocked);
};
