import { useCallback } from 'react';
import {
  checkEndOfGameAchievements,
  checkNewAchievements,
  applyAllRewards,
} from '../../core/achievements';
import { loadProfileWithDefaults } from '../../services/PlayerProfile';
import { updateDailyStreak } from '../../services/StreakService';
import { getCollectionStatsForAchievements, updateWeekendStats } from '../../services/AchievementStatsService';
import { notify } from '../../services/notifications';
import { resolveTotalQuestions } from './gameUtils';

const DAY_MS = 1000 * 60 * 60 * 24;
const DEFAULT_RARITY_COUNTS = Object.freeze({
  legendary: 0,
  epic: 0,
  rare: 0,
  uncommon: 0,
  common: 0,
});

const createDefaultValidatedStats = () => ({
  gamesPlayed: 0,
  totalQuestionsAnswered: 0,
  correctEasy: 0,
  easyQuestionsAnswered: 0,
  accuracyEasy: 0,
  correctRiddle: 0,
  riddleQuestionsAnswered: 0,
  accuracyRiddle: 0,
  correctHard: 0,
  hardQuestionsAnswered: 0,
  accuracyHard: 0,
  hardGamesCompleted: 0,
  longestStreak: 0,
  packsPlayed: {},
  speciesMastery: {},
  missedSpecies: [],
  rarityCounts: { ...DEFAULT_RARITY_COUNTS },
});

const computeLongestStreakFromEntries = (entries = []) => {
  let current = 0;
  let max = 0;
  entries.forEach((entry) => {
    if (entry?.wasCorrect) {
      current += 1;
      if (current > max) max = current;
      return;
    }
    current = 0;
  });
  return max;
};

/**
 * End-of-game rewards: stats aggregation, achievements, daily streak.
 */
export function useGameRewards({
  profile,
  updateProfile,
  queueAchievements,
  activePackId,
  gameMode,
  maxQuestions,
  isReviewMode,
  questionCount,
  currentStreak,
  longestStreak,
  clearSessionFromDB,
  setIsGameActive,
  setIsGameOver,
  setNextQuestion,
  setNewlyUnlocked,
  clearAchievementsTimer,
  clearUnlockedLater,
}) {
  const getDateKey = useCallback((date) => new Date(date).toISOString().split('T')[0], []);

  const daysBetween = useCallback((fromDateKey, toDateKey) => {
    const from = new Date(fromDateKey);
    const to = new Date(toDateKey);
    return Math.floor((to - from) / DAY_MS);
  }, []);

  const finalizeGame = useCallback(
    async ({
      finalCorrectAnswers,
      finalCorrectSpecies,
      finalMissedSpecies,
      speciesEntries = [],
    }) => {
      const profileClone = profile ? JSON.parse(JSON.stringify(profile)) : loadProfileWithDefaults();
      const totalQuestions = Array.isArray(speciesEntries)
        ? speciesEntries.length
        : resolveTotalQuestions(maxQuestions, questionCount);
      const validatedEntries = Array.isArray(speciesEntries)
        ? speciesEntries.filter((entry) => entry?.validatedEvent === true)
        : [];
      const validatedTotalQuestions = validatedEntries.length;
      const validatedCorrectEntries = validatedEntries.filter((entry) => entry?.wasCorrect);
      const validatedCorrectAnswers = validatedCorrectEntries.length;
      const validatedCorrectSpecies = Array.from(
        new Set(validatedCorrectEntries.map((entry) => entry?.id).filter(Boolean))
      );
      const validatedMissedSpecies = Array.from(
        new Set(validatedEntries.filter((entry) => !entry?.wasCorrect).map((entry) => entry?.id).filter(Boolean))
      );

      // ── Global stats ──
      profileClone.stats.gamesPlayed = (profileClone.stats.gamesPlayed || 0) + 1;
      profileClone.stats.totalQuestionsAnswered =
        (profileClone.stats.totalQuestionsAnswered || 0) + totalQuestions;
      if (gameMode === 'hard') {
        profileClone.stats.hardGamesCompleted = (profileClone.stats.hardGamesCompleted || 0) + 1;
      }

      if (gameMode === 'easy') {
        profileClone.stats.correctEasy = (profileClone.stats.correctEasy || 0) + finalCorrectAnswers;
        profileClone.stats.easyQuestionsAnswered =
          (profileClone.stats.easyQuestionsAnswered || 0) + totalQuestions;
        profileClone.stats.accuracyEasy =
          profileClone.stats.easyQuestionsAnswered > 0
            ? profileClone.stats.correctEasy / profileClone.stats.easyQuestionsAnswered
            : 0;
      } else if (gameMode === 'riddle') {
        profileClone.stats.correctRiddle = (profileClone.stats.correctRiddle || 0) + finalCorrectAnswers;
        profileClone.stats.riddleQuestionsAnswered =
          (profileClone.stats.riddleQuestionsAnswered || 0) + totalQuestions;
        profileClone.stats.accuracyRiddle =
          profileClone.stats.riddleQuestionsAnswered > 0
            ? profileClone.stats.correctRiddle / profileClone.stats.riddleQuestionsAnswered
            : 0;
      } else {
        profileClone.stats.correctHard = (profileClone.stats.correctHard || 0) + finalCorrectAnswers;
        profileClone.stats.hardQuestionsAnswered =
          (profileClone.stats.hardQuestionsAnswered || 0) + totalQuestions;
        profileClone.stats.accuracyHard =
          profileClone.stats.hardQuestionsAnswered > 0
            ? profileClone.stats.correctHard / profileClone.stats.hardQuestionsAnswered
            : 0;
      }

      // ── Species mastery ──
      profileClone.stats.speciesMastery = profileClone.stats.speciesMastery || {};
      finalCorrectSpecies.forEach((speciesId) => {
        if (!profileClone.stats.speciesMastery[speciesId]) {
          profileClone.stats.speciesMastery[speciesId] = { correct: 0 };
        }
        profileClone.stats.speciesMastery[speciesId].correct += 1;
      });

      const missedSet = new Set(profileClone.stats.missedSpecies || []);
      finalMissedSpecies.forEach((id) => missedSet.add(id));
      finalCorrectSpecies.forEach((id) => missedSet.delete(id));
      profileClone.stats.missedSpecies = Array.from(missedSet);

      // ── Pack stats ──
      if (!profileClone.stats.packsPlayed) profileClone.stats.packsPlayed = {};
      if (!profileClone.stats.packsPlayed[activePackId]) {
        profileClone.stats.packsPlayed[activePackId] = { correct: 0, answered: 0 };
      }
      profileClone.stats.packsPlayed[activePackId].correct += finalCorrectAnswers;
      profileClone.stats.packsPlayed[activePackId].answered += totalQuestions;

      // ── Biome mastery ──
      profileClone.stats.biomeMastery = profileClone.stats.biomeMastery || {};
      speciesEntries.forEach((entry) => {
        if (!entry || !Array.isArray(entry.biomes)) return;
        entry.biomes.forEach((biome) => {
          if (!biome) return;
          if (!profileClone.stats.biomeMastery[biome]) {
            profileClone.stats.biomeMastery[biome] = { correct: 0, total: 0 };
          }
          profileClone.stats.biomeMastery[biome].total += 1;
          if (finalCorrectSpecies.includes(entry.id)) {
            profileClone.stats.biomeMastery[biome].correct += 1;
          }
        });
      });

      // ── Rarity counts ──
      profileClone.stats.rarityCounts = profileClone.stats.rarityCounts || {
        legendary: 0,
        epic: 0,
        rare: 0,
        uncommon: 0,
        common: 0,
      };
      speciesEntries.forEach((entry) => {
        if (!entry?.wasCorrect) return;
        const tier = entry.rarity_tier;
        if (!tier || profileClone.stats.rarityCounts[tier] === undefined) return;
        profileClone.stats.rarityCounts[tier] += 1;
      });

      // ── Validated-only stats mirror ──
      profileClone.stats.validated = {
        ...createDefaultValidatedStats(),
        ...(profileClone.stats.validated || {}),
        packsPlayed: { ...(profileClone.stats.validated?.packsPlayed || {}) },
        speciesMastery: { ...(profileClone.stats.validated?.speciesMastery || {}) },
        rarityCounts: {
          ...DEFAULT_RARITY_COUNTS,
          ...(profileClone.stats.validated?.rarityCounts || {}),
        },
      };
      const validatedStats = profileClone.stats.validated;

      if (validatedTotalQuestions > 0) {
        validatedStats.gamesPlayed = (validatedStats.gamesPlayed || 0) + 1;
      }
      validatedStats.totalQuestionsAnswered =
        (validatedStats.totalQuestionsAnswered || 0) + validatedTotalQuestions;

      if (gameMode === 'easy') {
        validatedStats.correctEasy = (validatedStats.correctEasy || 0) + validatedCorrectAnswers;
        validatedStats.easyQuestionsAnswered =
          (validatedStats.easyQuestionsAnswered || 0) + validatedTotalQuestions;
        validatedStats.accuracyEasy =
          validatedStats.easyQuestionsAnswered > 0
            ? validatedStats.correctEasy / validatedStats.easyQuestionsAnswered
            : 0;
      } else if (gameMode === 'riddle') {
        validatedStats.correctRiddle = (validatedStats.correctRiddle || 0) + validatedCorrectAnswers;
        validatedStats.riddleQuestionsAnswered =
          (validatedStats.riddleQuestionsAnswered || 0) + validatedTotalQuestions;
        validatedStats.accuracyRiddle =
          validatedStats.riddleQuestionsAnswered > 0
            ? validatedStats.correctRiddle / validatedStats.riddleQuestionsAnswered
            : 0;
      } else {
        validatedStats.correctHard = (validatedStats.correctHard || 0) + validatedCorrectAnswers;
        validatedStats.hardQuestionsAnswered =
          (validatedStats.hardQuestionsAnswered || 0) + validatedTotalQuestions;
        validatedStats.accuracyHard =
          validatedStats.hardQuestionsAnswered > 0
            ? validatedStats.correctHard / validatedStats.hardQuestionsAnswered
            : 0;
        if (validatedTotalQuestions > 0 && gameMode === 'hard') {
          validatedStats.hardGamesCompleted = (validatedStats.hardGamesCompleted || 0) + 1;
        }
      }

      if (!validatedStats.packsPlayed[activePackId]) {
        validatedStats.packsPlayed[activePackId] = { correct: 0, answered: 0 };
      }
      validatedStats.packsPlayed[activePackId].correct += validatedCorrectAnswers;
      validatedStats.packsPlayed[activePackId].answered += validatedTotalQuestions;

      validatedCorrectSpecies.forEach((speciesId) => {
        if (!validatedStats.speciesMastery[speciesId]) {
          validatedStats.speciesMastery[speciesId] = { correct: 0 };
        }
        validatedStats.speciesMastery[speciesId].correct += 1;
      });

      const validatedMissedSet = new Set(validatedStats.missedSpecies || []);
      validatedMissedSpecies.forEach((id) => validatedMissedSet.add(id));
      validatedCorrectSpecies.forEach((id) => validatedMissedSet.delete(id));
      validatedStats.missedSpecies = Array.from(validatedMissedSet);

      validatedEntries.forEach((entry) => {
        if (!entry?.wasCorrect) return;
        const tier = entry.rarity_tier;
        if (!tier || validatedStats.rarityCounts[tier] === undefined) return;
        validatedStats.rarityCounts[tier] += 1;
      });
      validatedStats.longestStreak = Math.max(
        validatedStats.longestStreak || 0,
        computeLongestStreakFromEntries(validatedEntries)
      );

      // ── Review-mode tracking ──
      if (isReviewMode) {
        const todayKey = getDateKey(new Date());
        const lastReviewDate = profileClone.stats.lastReviewDate;
        let consecutiveReviewDays = profileClone.stats.consecutiveReviewDays || 0;

        if (lastReviewDate === todayKey) {
          consecutiveReviewDays = profileClone.stats.consecutiveReviewDays || 1;
        } else if (lastReviewDate) {
          const diffDays = daysBetween(lastReviewDate, todayKey);
          consecutiveReviewDays = diffDays === 1 ? (profileClone.stats.consecutiveReviewDays || 0) + 1 : 1;
        } else {
          consecutiveReviewDays = 1;
        }

        profileClone.stats.reviewSessionsCompleted =
          (profileClone.stats.reviewSessionsCompleted || 0) + 1;
        profileClone.stats.consecutiveReviewDays = consecutiveReviewDays;
        profileClone.stats.lastReviewDate = todayKey;
      }

      // ── End-of-game snapshot metrics ──
      const responseTimes = validatedEntries
        .map((entry) => entry?.responseTimeMs)
        .filter((value) => typeof value === 'number');
      const averageResponseTimeMs = responseTimes.length
        ? Math.round(responseTimes.reduce((sum, value) => sum + value, 0) / responseTimes.length)
        : null;
      const uniqueClassIds = new Set();
      validatedEntries.forEach((entry) => {
        const classAncestor = entry?.taxon?.ancestors?.find((ancestor) => ancestor.rank === 'class');
        const classId = classAncestor?.id ?? entry?.taxon?.iconic_taxon_id ?? null;
        if (classId) uniqueClassIds.add(classId);
      });
      const uniqueClassesInGame = uniqueClassIds.size;
      const lastFiveEntries = validatedEntries.slice(-5);
      const hadErrorBeforeLast5 = validatedEntries.slice(0, -5).some((entry) => !entry?.wasCorrect);
      const last5AllCorrect = lastFiveEntries.length === 5 && lastFiveEntries.every((entry) => entry?.wasCorrect);
      const validatedHintsUsed = validatedEntries.filter((entry) => entry?.hintsUsed).length;
      const validatedShieldsUsed = validatedEntries.filter((entry) => !entry?.wasCorrect).length;
      const validatedSessionXP = validatedEntries.reduce(
        (sum, entry) => sum + (Number.isFinite(entry?.earnedXp) ? entry.earnedXp : 0),
        0
      );

      // ── Daily streak + weekend ──
      const profileWithStreakUpdate = updateDailyStreak(profileClone);
      const profileWithWeekendStats = {
        ...profileWithStreakUpdate,
        stats: updateWeekendStats(profileWithStreakUpdate.stats, new Date()),
      };

      profileWithWeekendStats.stats.lastSessionStreak = currentStreak;
      if (longestStreak > (profileWithWeekendStats.stats.longestStreak || 0)) {
        profileWithWeekendStats.stats.longestStreak = longestStreak;
      }

      // ── Achievement checks ──
      let collectionStats = {};
      try {
        collectionStats = await getCollectionStatsForAchievements();
      } catch (error) {
        console.error('[GameContext] Failed to load collection stats for achievements:', error);
      }
      const unlocked = checkNewAchievements(profileWithWeekendStats, collectionStats);
      const endOfGameUnlocked = checkEndOfGameAchievements(
        {
          sessionXP: validatedSessionXP,
          gameHour: new Date().getHours(),
          totalQuestions: validatedTotalQuestions,
          correctAnswers: validatedCorrectAnswers,
          hintsUsed: validatedHintsUsed,
          shieldsUsed: validatedShieldsUsed,
          gameMode,
          gameWon: validatedCorrectAnswers > 0,
          averageResponseTimeMs,
          uniqueClassesInGame,
          hadErrorBeforeLast5,
          last5AllCorrect,
        },
        profileWithWeekendStats.achievements
      );

      const allUnlocked = [...new Set([...unlocked, ...endOfGameUnlocked])];

      if (allUnlocked.length > 0) {
        profileWithWeekendStats.achievements = Array.from(
          new Set([...(profileWithWeekendStats.achievements || []), ...allUnlocked])
        );
        const rewardResult = applyAllRewards(profileWithWeekendStats, allUnlocked);
        Object.assign(profileWithWeekendStats, rewardResult.profile);

        if (rewardResult.totalXP > 0) {
          notify(`🎉 +${rewardResult.totalXP} XP bonus!`, { type: 'success', duration: 4000 });
        }
        if (rewardResult.titlesUnlocked.length > 0) {
          notify('🏷️ Nouveau titre débloqué!', { type: 'success', duration: 4000 });
        }
        if (rewardResult.bordersUnlocked.length > 0) {
          notify('🖼️ Nouvelle bordure débloquée!', { type: 'success', duration: 4000 });
        }

        queueAchievements(allUnlocked);
        setNewlyUnlocked(allUnlocked);
        clearUnlockedLater();
      } else {
        setNewlyUnlocked([]);
        clearAchievementsTimer();
      }

      // ── Persist & transition ──
      clearSessionFromDB()
        .then(() => {
          updateProfile(profileWithWeekendStats);
          setIsGameActive(false);
          setIsGameOver(true);
          setNextQuestion(null);
        })
        .catch((err) => {
          console.error('[GameContext] Error clearing session after game end:', err);
          updateProfile(profileWithStreakUpdate);
          setIsGameActive(false);
          setIsGameOver(true);
          setNextQuestion(null);
        });
    },
    [
      activePackId,
      clearAchievementsTimer,
      clearSessionFromDB,
      clearUnlockedLater,
      currentStreak,
      daysBetween,
      getDateKey,
      gameMode,
      isReviewMode,
      longestStreak,
      maxQuestions,
      profile,
      questionCount,
      queueAchievements,
      setIsGameActive,
      setIsGameOver,
      setNewlyUnlocked,
      setNextQuestion,
      updateProfile,
    ]
  );

  return { finalizeGame };
}
