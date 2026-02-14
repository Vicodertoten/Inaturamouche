import { useCallback } from 'react';
import {
  checkEndOfGameAchievements,
  checkNewAchievements,
  evaluateMicroChallenges,
  applyAllRewards,
} from '../../core/achievements';
import { loadProfileWithDefaults } from '../../services/PlayerProfile';
import { updateDailyStreak } from '../../services/StreakService';
import { getCollectionStatsForAchievements, updateWeekendStats } from '../../services/AchievementStatsService';
import { getSpeciesDueForReview } from '../../services/CollectionService';
import { notify } from '../../services/notifications';
import { notifyApiError } from '../../services/api';
import { getLevelFromXp } from '../../utils/scoring';
import { getRarityInfo } from '../../utils/rarityUtils';
import { computeRoundEconomy } from '../../utils/economy';
import {
  createSeedSessionId,
  getBiomesForQuestion,
  hasQuestionLimit,
  normalizeGameMode,
  normalizeMaxQuestions,
  normalizeMediaType,
  resolveTotalQuestions,
} from './gameUtils';

const LIGHTNING_THRESHOLD_MS = 1500;
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

export function useGameActions({
  profile,
  updateProfile,
  queueAchievements,
  addSpeciesToCollection,
  activePackId,
  activePack,
  gameMode,
  maxQuestions,
  isReviewMode,
  setGameMode,
  setMaxQuestions,
  setMediaType,
  setIsReviewMode,
  setReviewTaxonIds,
  setDailySeed,
  setDailySeedSession,
  isGameActive,
  setIsGameActive,
  setIsStartingNewGame,
  setIsGameOver,
  question,
  setQuestion,
  nextQuestion,
  setNextQuestion,
  questionCount,
  setQuestionCount,
  score,
  setScore,
  sessionStats,
  setSessionStats,
  sessionCorrectSpecies,
  setSessionCorrectSpecies,
  sessionSpeciesData,
  setSessionSpeciesData,
  sessionMissedSpecies,
  setSessionMissedSpecies,
  setError,
  setLoading,
  abortActiveFetch,
  abortPrefetchFetch,
  fetchQuestion,
  clearSessionFromDB,
  questionStartTimeRef,
  currentStreak,
  setCurrentStreak,
  longestStreak,
  setLongestStreak,
  inGameShields,
  setInGameShields,
  hasPermanentShield,
  setNewlyUnlocked,
  setRecentXPGain,
  setInitialSessionXP,
  setLevelUpNotification,
  calculateXPMultipliers,
  clearAchievementsTimer,
  clearUnlockedLater,
  setRarityCelebration,
}) {
  const getDateKey = useCallback((date) => new Date(date).toISOString().split('T')[0], []);

  const daysBetween = useCallback((fromDateKey, toDateKey) => {
    const from = new Date(fromDateKey);
    const to = new Date(toDateKey);
    return Math.floor((to - from) / DAY_MS);
  }, []);

  const triggerRarityCelebration = useCallback(
    (tier) => {
      if (!setRarityCelebration || !tier) return;
      setRarityCelebration({ tier, stamp: Date.now() });
    },
    [setRarityCelebration]
  );

  const resetSessionState = useCallback(() => {
    setScore(0);
    setSessionStats({ correctAnswers: 0 });
    setSessionCorrectSpecies([]);
    setSessionSpeciesData([]);
    setSessionMissedSpecies([]);
    setNewlyUnlocked([]);
    setRarityCelebration?.(null);
    setInGameShields(hasPermanentShield ? 1 : 0);
    setRecentXPGain(0);
    setInitialSessionXP(profile?.xp || 0);
    setLevelUpNotification(null);
    clearAchievementsTimer();
  }, [
    clearAchievementsTimer,
    hasPermanentShield,
    profile?.xp,
    setInGameShields,
    setInitialSessionXP,
    setLevelUpNotification,
    setNewlyUnlocked,
    setRecentXPGain,
    setScore,
    setSessionCorrectSpecies,
    setSessionMissedSpecies,
    setSessionSpeciesData,
    setSessionStats,
    setRarityCelebration,
  ]);

  const resetToLobby = useCallback(
    async (clearSession = true) => {
      abortActiveFetch();
      abortPrefetchFetch();
      setIsGameActive(false);
      setIsGameOver(false);
      setQuestionCount(0);
      setQuestion(null);
      setNextQuestion(null);
      setError(null);
      setIsReviewMode(false);
      setReviewTaxonIds([]);
      if (clearSession) {
        resetSessionState();
        await clearSessionFromDB();
      }
      setDailySeed(null);
      setDailySeedSession(null);
    },
    [
      abortActiveFetch,
      abortPrefetchFetch,
      clearSessionFromDB,
      resetSessionState,
      setDailySeed,
      setDailySeedSession,
      setError,
      setIsGameActive,
      setIsGameOver,
      setIsReviewMode,
      setNextQuestion,
      setQuestion,
      setQuestionCount,
      setReviewTaxonIds,
    ]
  );

  const updateScore = useCallback((delta) => {
    setScore((prev) => prev + delta);
  }, [setScore]);

  const startGame = useCallback(
    ({
      review = false,
      maxQuestions: nextMaxQuestions,
      mediaType: nextMediaType,
      gameMode: nextGameMode,
      seed,
    } = {}) => {
      abortActiveFetch();
      abortPrefetchFetch();
      resetSessionState();
      clearSessionFromDB().catch((err) =>
        console.error('[GameContext] Error clearing session at game start:', err)
      );
      setIsStartingNewGame(true);
      const normalizedSeed = typeof seed === 'string' ? seed.trim() : '';
      const isDailyChallenge = normalizedSeed.length > 0;
      const forcedMaxQuestions = isDailyChallenge ? 10 : nextMaxQuestions;
      const forcedGameMode = isDailyChallenge ? 'hard' : nextGameMode;

      setDailySeed(isDailyChallenge ? normalizedSeed : null);
      setDailySeedSession(isDailyChallenge ? createSeedSessionId() : null);
      setQuestion(null);
      setNextQuestion(null);
      setError(null);
      setQuestionCount(1);
      setIsGameActive(true);
      setIsGameOver(false);
      setIsReviewMode(isDailyChallenge ? false : review);
      if (!review) {
        setReviewTaxonIds([]);
      }
      setInitialSessionXP(profile?.xp || 0);
      setGameMode((prev) => (forcedGameMode === undefined ? prev : normalizeGameMode(forcedGameMode, prev)));
      setMaxQuestions((prev) =>
        forcedMaxQuestions === undefined ? prev : normalizeMaxQuestions(forcedMaxQuestions, prev)
      );
      setMediaType((prev) => (nextMediaType === undefined ? prev : normalizeMediaType(nextMediaType, prev)));
    },
    [
      abortActiveFetch,
      abortPrefetchFetch,
      clearSessionFromDB,
      profile?.xp,
      resetSessionState,
      setDailySeed,
      setDailySeedSession,
      setError,
      setGameMode,
      setInitialSessionXP,
      setIsGameActive,
      setIsGameOver,
      setIsReviewMode,
      setIsStartingNewGame,
      setMaxQuestions,
      setMediaType,
      setNextQuestion,
      setQuestion,
      setQuestionCount,
      setReviewTaxonIds,
    ]
  );

  const startReviewMode = useCallback(async () => {
    try {
      const speciesToReview = await getSpeciesDueForReview(50);
      const taxonIds = speciesToReview
        .map(({ taxon }) => taxon?.id)
        .filter((id) => Number.isFinite(id));

      if (taxonIds.length === 0) {
        notify("Aucune espèce à réviser aujourd'hui ! 🎉", {
          type: 'success',
          duration: 3000,
        });
        return false;
      }

      setReviewTaxonIds(taxonIds);
      startGame({ review: true, gameMode: 'easy', maxQuestions: taxonIds.length });

      notify(`📚 ${taxonIds.length} espèce${taxonIds.length > 1 ? 's' : ''} à réviser`, {
        type: 'info',
        duration: 3000,
      });

      return true;
    } catch (error) {
      console.error('Failed to start review mode:', error);
      if (typeof notifyApiError === 'function') {
        notifyApiError(error, 'Impossible de démarrer le mode révision');
      } else {
        notify('Impossible de démarrer le mode révision', { type: 'error' });
      }
      return false;
    }
  }, [setReviewTaxonIds, startGame]);

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

      if (!profileClone.stats.packsPlayed) profileClone.stats.packsPlayed = {};
      if (!profileClone.stats.packsPlayed[activePackId]) {
        profileClone.stats.packsPlayed[activePackId] = { correct: 0, answered: 0 };
      }
      profileClone.stats.packsPlayed[activePackId].correct += finalCorrectAnswers;
      profileClone.stats.packsPlayed[activePackId].answered += totalQuestions;
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

      // Keep a validated-only stats mirror for achievement integrity.
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

      const profileWithStreakUpdate = updateDailyStreak(profileClone);
      const profileWithWeekendStats = {
        ...profileWithStreakUpdate,
        stats: updateWeekendStats(profileWithStreakUpdate.stats, new Date()),
      };

      profileWithWeekendStats.stats.lastSessionStreak = currentStreak;
      if (longestStreak > (profileWithWeekendStats.stats.longestStreak || 0)) {
        profileWithWeekendStats.stats.longestStreak = longestStreak;
      }

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

  const completeRound = useCallback(
    ({
      points = 0,
      bonus = 0,
      streakBonus = 0,
      isCorrect = null,
      roundMeta = {},
      resolvedQuestion = null,
      validationResult = null,
    } = {}) => {
      const activeQuestion = resolvedQuestion || question;
      const resolvedAnswer = activeQuestion?.bonne_reponse || validationResult?.correct_answer || null;
      if (!activeQuestion || !resolvedAnswer?.id) return;

      const currentQuestionId = resolvedAnswer.id;
      const isCorrectFinal = typeof isCorrect === 'boolean' ? isCorrect : points > 0;

      let newStreak = currentStreak;
      if (!isCorrectFinal) {
        if (inGameShields > 0) {
          setInGameShields((prev) => prev - 1);
        } else {
          const finalStreak = currentStreak;
          if (finalStreak > longestStreak) {
            setLongestStreak(finalStreak);
          }
          newStreak = 0;
        }
      } else {
        newStreak = currentStreak + 1;
        if (newStreak > longestStreak) {
          setLongestStreak(newStreak);
        }
        if (newStreak % 5 === 0 && inGameShields < 3) {
          setInGameShields((prev) => Math.min(prev + 1, 3));
        }
      }

      setCurrentStreak(newStreak);

      const isValidatedRoundEvent = roundMeta?.serverValidated === true;
      const modeForRound = roundMeta.mode || gameMode;
      const hintCountForRound = Math.max(0, Number.parseInt(String(roundMeta?.hintCount || 0), 10) || 0);
      const repeatCountForTaxon = sessionSpeciesData.filter(
        (entry) => entry?.id === currentQuestionId && entry?.wasCorrect
      ).length;

      const adjustedBonus = (bonus || 0) + (streakBonus || 0);
      const roundEconomyBase = computeRoundEconomy({
        isCorrect: isCorrectFinal,
        points,
        bonus,
        streakBonus,
        mode: modeForRound,
        hintCount: hintCountForRound,
        repeatCount: repeatCountForTaxon,
        rarityBonusXp: 0,
      });

      const updatedScore = score + roundEconomyBase.scoreDelta;
      setScore(updatedScore);

      const rarityInfo = getRarityInfo(resolvedAnswer?.observations_count);
      const rarityBonusXp = isCorrectFinal ? Math.max(0, rarityInfo.bonusXp || 0) : 0;
      if (isCorrectFinal && rarityBonusXp > 0) {
        if (rarityInfo.tier === 'legendary' || rarityInfo.tier === 'epic') {
          triggerRarityCelebration(rarityInfo.tier);
          notify(`✨ ${rarityInfo.label} +${rarityBonusXp} XP`, {
            type: 'success',
            duration: 2500,
          });
        }
      }

      const roundEconomyWithRarity = computeRoundEconomy({
        isCorrect: isCorrectFinal,
        points,
        bonus,
        streakBonus,
        mode: modeForRound,
        hintCount: hintCountForRound,
        repeatCount: repeatCountForTaxon,
        rarityBonusXp,
      });

      let xpBeforeProfileMultipliers = roundEconomyWithRarity.xpBeforeProfileMultipliers;

      if (isReviewMode && xpBeforeProfileMultipliers > 0) {
        const reviewBonus = Math.floor(xpBeforeProfileMultipliers * 0.25);
        xpBeforeProfileMultipliers += reviewBonus;

        if (questionCount === 1) {
          notify('📚 Mode Révision : +25% XP', {
            type: 'info',
            duration: 3000,
          });
        }
      }

      const xpMultipliers = calculateXPMultipliers(profile, isCorrectFinal ? newStreak : 0);
      const earnedXP = Math.floor(xpBeforeProfileMultipliers * xpMultipliers.totalMultiplier);

      if (earnedXP > 0) {
        setRecentXPGain(earnedXP);

        setTimeout(() => {
          setRecentXPGain(0);
        }, 2000);

        updateProfile((prev) => {
          const base = prev ?? loadProfileWithDefaults();
          const oldXP = base.xp || 0;
          const newXP = oldXP + earnedXP;
          const oldLevel = getLevelFromXp(oldXP);
          const newLevel = getLevelFromXp(newXP);

          if (newLevel > oldLevel) {
            setLevelUpNotification({
              oldLevel,
              newLevel,
              timestamp: Date.now(),
            });

            setTimeout(() => {
              setLevelUpNotification(null);
            }, 4000);
          }

          return {
            ...base,
            xp: newXP,
          };
        });
      }

      const now =
        typeof performance !== 'undefined' && typeof performance.now === 'function'
          ? performance.now()
          : Date.now();
      const responseStart = questionStartTimeRef.current;
      const responseTimeMs =
        typeof responseStart === 'number' ? Math.max(0, Math.round(now - responseStart)) : null;
      const derivedBiomes = getBiomesForQuestion(activeQuestion, activePack);
      const genusEntry =
        resolvedAnswer?.ancestors?.find((ancestor) => ancestor.rank === 'genus') || null;
      const fallbackImageUrl =
        resolvedAnswer?.default_photo?.square_url ||
        resolvedAnswer?.default_photo?.url ||
        resolvedAnswer?.photos?.[0]?.square_url ||
        resolvedAnswer?.photos?.[0]?.url ||
        activeQuestion.image_urls?.[0] ||
        null;
      const taxonPayload = {
        ...resolvedAnswer,
      };
      if (!taxonPayload.rarity_tier && rarityInfo.tier !== 'unknown') {
        taxonPayload.rarity_tier = rarityInfo.tier;
      }
      if (!taxonPayload.default_photo && fallbackImageUrl) {
        taxonPayload.default_photo = { url: fallbackImageUrl, square_url: fallbackImageUrl };
      }
      if (!taxonPayload.square_url && fallbackImageUrl) {
        taxonPayload.square_url = fallbackImageUrl;
      }
      const roundDetails = {
        mode: roundMeta.mode || gameMode,
        ...roundMeta,
        serverValidated: isValidatedRoundEvent,
        wasCorrect: isCorrectFinal,
        responseTimeMs,
        biomes: derivedBiomes,
      };

      const finalCorrectAnswers = sessionStats.correctAnswers + (isCorrectFinal ? 1 : 0);
      const finalCorrectSpecies = isCorrectFinal
        ? [...sessionCorrectSpecies, currentQuestionId]
        : sessionCorrectSpecies.slice();
      const finalMissedSpecies = isCorrectFinal
        ? sessionMissedSpecies.filter((id) => id !== currentQuestionId)
        : [...sessionMissedSpecies, currentQuestionId];

      const speciesEntry = {
        id: currentQuestionId,
        name: resolvedAnswer.name,
        preferred_common_name: resolvedAnswer.preferred_common_name,
        common_name: resolvedAnswer.preferred_common_name || resolvedAnswer.common_name,
        wikipedia_url: resolvedAnswer.wikipedia_url,
        inaturalist_url: activeQuestion.inaturalist_url || validationResult?.inaturalist_url || null,
        observations_count: resolvedAnswer.observations_count ?? null,
        rarity_tier: taxonPayload.rarity_tier || null,
        conservation_status: resolvedAnswer.conservation_status ?? null,
        default_photo: taxonPayload.default_photo || null,
        square_url: taxonPayload.square_url || null,
        taxon: taxonPayload,
        bonus: adjustedBonus,
        streak: newStreak,
        biomes: derivedBiomes,
        hintsUsed: !!roundDetails.hintsUsed,
        hintCount: roundDetails.hintCount || 0,
        responseTimeMs,
        genusId: genusEntry?.id || null,
        genusName: genusEntry?.name || null,
        wasCorrect: isCorrectFinal,
        validatedEvent: isValidatedRoundEvent,
        earnedXp: earnedXP,
        multiplierApplied: xpMultipliers?.totalMultiplier ?? 1.0,
        economy: {
          scoreDelta: roundEconomyWithRarity.scoreDelta,
          baseXp: roundEconomyWithRarity.baseXp,
          xpBeforeProfileMultipliers,
          repeatCount: roundEconomyWithRarity.repeatCount,
          repeatXpMultiplier: roundEconomyWithRarity.repeatXpMultiplier,
          hintCount: roundEconomyWithRarity.hintCount,
          hintXpMultiplier: roundEconomyWithRarity.hintXpMultiplier,
          gameplayXpMultiplier: roundEconomyWithRarity.gameplayXpMultiplier,
          rarityBonusXp,
        },
      };
      if (addSpeciesToCollection) {
        void addSpeciesToCollection(taxonPayload, isCorrectFinal, fallbackImageUrl);
      }
      const nextSpeciesData = [...sessionSpeciesData, speciesEntry];
      const validatedSpeciesData = nextSpeciesData.filter((entry) => entry?.validatedEvent === true);
      const consecutiveFastAnswers = (() => {
        let count = 0;
        for (let i = validatedSpeciesData.length - 1; i >= 0; i -= 1) {
          const entry = validatedSpeciesData[i];
          if (!entry?.wasCorrect) break;
          if (typeof entry.responseTimeMs !== 'number' || entry.responseTimeMs > LIGHTNING_THRESHOLD_MS) break;
          count += 1;
        }
        return count;
      })();
      const hintsUsedInSession = validatedSpeciesData.filter((entry) => entry?.hintsUsed).length;
      const correctAnswersInSession = validatedSpeciesData.filter((entry) => entry?.wasCorrect).length;
      const shieldsUsedInSession = validatedSpeciesData.filter((entry) => !entry?.wasCorrect).length;
      const validatedSessionXP = validatedSpeciesData.reduce(
        (sum, entry) => sum + (Number.isFinite(entry?.earnedXp) ? entry.earnedXp : 0),
        0
      );

      const microUnlocks = isValidatedRoundEvent
        ? evaluateMicroChallenges(
            {
              currentStreak: newStreak,
              roundMeta: {
                ...roundDetails,
                serverValidated: isValidatedRoundEvent,
              },
              sessionSpeciesData: validatedSpeciesData,
              consecutiveFastAnswers,
              sessionXP: validatedSessionXP,
              totalQuestionsAnswered: validatedSpeciesData.length,
              hintsUsedInSession,
              correctAnswersInSession,
              shieldsUsed: shieldsUsedInSession,
              gameMode: modeForRound,
            },
            profile?.achievements || []
          )
        : [];
      if (microUnlocks.length) {
        let freshUnlocks = [];
        updateProfile((prevProfile) => {
          const baseProfile = prevProfile ?? loadProfileWithDefaults();
          const existing = new Set(baseProfile.achievements || []);
          const newIds = microUnlocks.filter((id) => !existing.has(id));
          if (!newIds.length) {
            freshUnlocks = [];
            return baseProfile;
          }
          newIds.forEach((id) => existing.add(id));
          freshUnlocks = newIds;
          return {
            ...baseProfile,
            achievements: Array.from(existing),
          };
        });
        if (freshUnlocks.length) {
          queueAchievements(freshUnlocks);
        }
      }

      setSessionStats({ correctAnswers: finalCorrectAnswers });
      setSessionCorrectSpecies(finalCorrectSpecies);
      setSessionMissedSpecies(finalMissedSpecies);
      setSessionSpeciesData(nextSpeciesData);

      const hasLimit = hasQuestionLimit(maxQuestions);
      if (!hasLimit || questionCount < maxQuestions) {
        setQuestionCount((prev) => prev + 1);
        if (nextQuestion) {
          setQuestion(nextQuestion);
          setNextQuestion(null);
          fetchQuestion(true);
        } else {
          setQuestion(null);
          fetchQuestion();
        }
      } else {
        finalizeGame({
          finalCorrectAnswers,
          finalScore: updatedScore,
          finalCorrectSpecies,
          finalMissedSpecies,
          speciesEntries: nextSpeciesData,
        });
      }
    },
    [
      activePack,
      addSpeciesToCollection,
      calculateXPMultipliers,
      currentStreak,
      fetchQuestion,
      finalizeGame,
      gameMode,
      inGameShields,
      isReviewMode,
      longestStreak,
      maxQuestions,
      nextQuestion,
      profile,
      question,
      questionStartTimeRef,
      questionCount,
      queueAchievements,
      score,
      sessionCorrectSpecies,
      sessionMissedSpecies,
      sessionSpeciesData,
      sessionStats.correctAnswers,
      setCurrentStreak,
      setInGameShields,
      setLevelUpNotification,
      setLongestStreak,
      setNextQuestion,
      setQuestion,
      setQuestionCount,
      setRecentXPGain,
      setScore,
      setSessionCorrectSpecies,
      setSessionMissedSpecies,
      setSessionSpeciesData,
      setSessionStats,
      triggerRarityCelebration,
      updateProfile,
    ]
  );

  const endGame = useCallback(() => {
    if (!isGameActive) return;
    abortActiveFetch();
    abortPrefetchFetch();
    setLoading(false);
    finalizeGame({
      finalCorrectAnswers: sessionStats.correctAnswers,
      finalScore: score,
      finalCorrectSpecies: sessionCorrectSpecies,
      finalMissedSpecies: sessionMissedSpecies,
      speciesEntries: sessionSpeciesData,
    });
  }, [
    abortActiveFetch,
    abortPrefetchFetch,
    finalizeGame,
    isGameActive,
    score,
    sessionCorrectSpecies,
    sessionMissedSpecies,
    sessionSpeciesData,
    sessionStats.correctAnswers,
    setLoading,
  ]);

  return {
    resetSessionState,
    resetToLobby,
    updateScore,
    startGame,
    startReviewMode,
    finalizeGame,
    completeRound,
    endGame,
    triggerRarityCelebration,
  };
}
