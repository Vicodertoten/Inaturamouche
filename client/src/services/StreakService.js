import { notify } from './notifications.js';

/**
 * Get today's date as ISO string (YYYY-MM-DD)
 */
const getToday = () => new Date().toISOString().split('T')[0];

/**
 * Calculate days between two ISO date strings
 */
const daysBetween = (dateStr1, dateStr2) => {
  const date1 = new Date(dateStr1);
  const date2 = new Date(dateStr2);
  const diffTime = date2 - date1;
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
};

/**
 * Check and update daily streak on app initialization
 * Returns updated profile or original if no changes needed
 */
export const checkDailyStreak = (profile) => {
  if (!profile?.dailyStreak) {
    return profile;
  }

  const today = getToday();
  const lastPlayed = profile.dailyStreak.lastPlayedDate
    ? new Date(profile.dailyStreak.lastPlayedDate).toISOString().split('T')[0]
    : null;

  // First launch or no previous play data
  if (!lastPlayed) {
    return profile;
  }

  // Already played today
  if (lastPlayed === today) {
    return profile;
  }

  // Calculate difference in days
  const diffDays = daysBetween(lastPlayed, today);

  const updatedProfile = { ...profile };

  // Case 1: Played yesterday (streak continues)
  if (diffDays === 1) {
    // Streak continues, but don't increment here
    // It will be incremented when the player completes a game
    return profile;
  }

  // Case 2: Missed 1 or more days
  if (diffDays > 1) {
    // Check if shield can be used
    if (
      updatedProfile.dailyStreak.shields > 0 &&
      !updatedProfile.dailyStreak.shieldUsedToday
    ) {
      // Consume 1 shield
      updatedProfile.dailyStreak.shields -= 1;
      updatedProfile.dailyStreak.shieldUsedToday = true;

      notify('🛡️ Bouclier utilisé! Streak préservée.', {
        type: 'info',
        duration: 4000,
      });

      return updatedProfile;
    } else {
      // No shield - reset streak
      updatedProfile.dailyStreak.current = 0;
      updatedProfile.dailyStreak.shieldUsedToday = false;

      notify('💔 Streak perdue! Recommence à zéro.', {
        type: 'warning',
        duration: 4000,
      });

      return updatedProfile;
    }
  }

  return profile;
};

/**
 * Update daily streak after completing a game
 * Returns updated profile with streak incremented and milestones checked
 */
export const updateDailyStreak = (profile) => {
  if (!profile?.dailyStreak) {
    return profile;
  }

  const now = new Date();
  const today = getToday();

  const lastPlayed = profile.dailyStreak.lastPlayedDate
    ? new Date(profile.dailyStreak.lastPlayedDate).toISOString().split('T')[0]
    : null;

  const updatedProfile = { ...profile };

  // First game of the day
  if (lastPlayed !== today) {
    let newStreak = 1;

    if (lastPlayed) {
      const diffDays = daysBetween(lastPlayed, today);

      // Streak continues (played yesterday)
      if (diffDays === 1) {
        newStreak = updatedProfile.dailyStreak.current + 1;
      }
      // Otherwise streak was already reset by checkDailyStreak
    }

    updatedProfile.dailyStreak.current = newStreak;
    updatedProfile.dailyStreak.lastPlayedDate = now.toISOString();
    updatedProfile.dailyStreak.shieldUsedToday = false;

    // Check for new personal record
    if (newStreak > updatedProfile.dailyStreak.longest) {
      updatedProfile.dailyStreak.longest = newStreak;
    }

    // Earn shield every 7 days
    if (
      newStreak % 7 === 0 &&
      updatedProfile.dailyStreak.shields < 3
    ) {
      updatedProfile.dailyStreak.shields += 1;

      notify('🛡️ +1 Bouclier gagné! (Max 3)', {
        type: 'success',
        duration: 4000,
      });
    }

    // Unlock milestones and XP bonuses
    // FIX #4: Add timestamp check to prevent duplicate milestone notifications
    const nowTimestamp = Date.now();
    const milestoneKey = `milestone_${newStreak}_timestamp`;
    const lastMilestoneTime = updatedProfile.dailyStreak[milestoneKey] || 0;
    const ONE_MINUTE = 60 * 1000;
    
    if (
      newStreak === 7 &&
      !updatedProfile.dailyStreak.streakMilestones[7]
    ) {
      // Only trigger if not recently triggered (within last minute)
      if (nowTimestamp - lastMilestoneTime > ONE_MINUTE) {
        updatedProfile.dailyStreak.streakMilestones[7] = true;
        updatedProfile.dailyStreak.streakBonusXP = 0.1;
        updatedProfile.dailyStreak[milestoneKey] = nowTimestamp;

        notify('🔥 Streak 7 jours! +10% XP permanent activé', {
          type: 'success',
          duration: 5000,
        });
      }
    }

    if (
      newStreak === 14 &&
      !updatedProfile.dailyStreak.streakMilestones[14]
    ) {
      const milestoneKey14 = `milestone_${newStreak}_timestamp`;
      const lastMilestoneTime14 = updatedProfile.dailyStreak[milestoneKey14] || 0;
      if (nowTimestamp - lastMilestoneTime14 > ONE_MINUTE) {
        updatedProfile.dailyStreak.streakMilestones[14] = true;
        updatedProfile.dailyStreak.streakBonusXP = 0.2;
        updatedProfile.dailyStreak[milestoneKey14] = nowTimestamp;

        notify('🔥🔥 Streak 14 jours! +20% XP permanent activé', {
          type: 'success',
          duration: 5000,
        });
      }
    }

    if (
      newStreak === 30 &&
      !updatedProfile.dailyStreak.streakMilestones[30]
    ) {
      const milestoneKey30 = `milestone_${newStreak}_timestamp`;
      const lastMilestoneTime30 = updatedProfile.dailyStreak[milestoneKey30] || 0;
      if (nowTimestamp - lastMilestoneTime30 > ONE_MINUTE) {
        updatedProfile.dailyStreak.streakMilestones[30] = true;
        updatedProfile.dailyStreak.streakBonusXP = 0.3;
        updatedProfile.dailyStreak[milestoneKey30] = nowTimestamp;

        notify('🔥🔥🔥 Streak 30 jours! +30% XP permanent activé', {
          type: 'success',
          duration: 6000,
        });
      }
    }
  }

  return updatedProfile;
};

/**
 * Apply XP bonus from daily streak
 */
export const applyXPWithStreakBonus = (baseXP, profile) => {
  const streakBonus = profile?.dailyStreak?.streakBonusXP || 0;
  return Math.floor(baseXP * (1 + streakBonus));
};
