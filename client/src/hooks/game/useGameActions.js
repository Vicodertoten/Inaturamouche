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

export function useGameActions({
  profile,
  updateProfile,
  queueAchievements,
  addSpeciesToCollection,
  activePackId,
  activePack,
  gameMode,
  maxQuestions,
  mediaType,
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
      finalScore,
      finalCorrectSpecies,
      finalMissedSpecies,
      speciesEntries = [],
    }) => {
      const profileClone = profile ? JSON.parse(JSON.stringify(profile)) : loadProfileWithDefaults();
      const totalQuestions = Array.isArray(speciesEntries)
        ? speciesEntries.length
        : resolveTotalQuestions(maxQuestions, questionCount);

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

      const responseTimes = speciesEntries
        .map((entry) => entry?.responseTimeMs)
        .filter((value) => typeof value === 'number');
      const averageResponseTimeMs = responseTimes.length
        ? Math.round(responseTimes.reduce((sum, value) => sum + value, 0) / responseTimes.length)
        : null;
      const uniqueClassIds = new Set();
      speciesEntries.forEach((entry) => {
        const classAncestor = entry?.taxon?.ancestors?.find((ancestor) => ancestor.rank === 'class');
        const classId = classAncestor?.id ?? entry?.taxon?.iconic_taxon_id ?? null;
        if (classId) uniqueClassIds.add(classId);
      });
      const uniqueClassesInGame = uniqueClassIds.size;
      const lastFiveEntries = speciesEntries.slice(-5);
      const hadErrorBeforeLast5 = speciesEntries.slice(0, -5).some((entry) => !entry?.wasCorrect);
      const last5AllCorrect = lastFiveEntries.length === 5 && lastFiveEntries.every((entry) => entry?.wasCorrect);

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
          sessionXP: finalScore,
          gameHour: new Date().getHours(),
          totalQuestions,
          correctAnswers: finalCorrectAnswers,
          hintsUsed: speciesEntries.filter((e) => e.hintsUsed).length,
          shieldsUsed: speciesEntries.filter((e) => !e.wasCorrect).length,
          gameMode,
          gameWon: finalCorrectAnswers > 0,
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
      getCollectionStatsForAchievements,
      getDateKey,
      gameMode,
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
    ({ points = 0, bonus = 0, streakBonus = 0, isCorrect = null, roundMeta = {} } = {}) => {
      if (!question) return;

      const currentQuestionId = question.bonne_reponse.id;
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

      const baseBonus = (bonus || 0) + (streakBonus || 0);
      const adjustedBonus = baseBonus;
      const updatedScore = score + points + adjustedBonus;
      setScore(updatedScore);

      const rarityInfo = getRarityInfo(question?.bonne_reponse?.observations_count);
      let baseXP = isCorrectFinal ? points + adjustedBonus : 0;
      if (isCorrectFinal && rarityInfo.bonusXp > 0) {
        baseXP += rarityInfo.bonusXp;
        if (rarityInfo.tier === 'legendary' || rarityInfo.tier === 'epic') {
          triggerRarityCelebration(rarityInfo.tier);
          notify(`✨ ${rarityInfo.label} +${rarityInfo.bonusXp} XP`, {
            type: 'success',
            duration: 2500,
          });
        }
      }

      if (isReviewMode && baseXP > 0) {
        const reviewBonus = Math.floor(baseXP * 0.25);
        baseXP += reviewBonus;

        if (questionCount === 1) {
          notify('📚 Mode Révision : +25% XP', {
            type: 'info',
            duration: 3000,
          });
        }
      }

      const xpMultipliers = calculateXPMultipliers(profile, isCorrectFinal ? newStreak : 0);
      const earnedXP = Math.floor(baseXP * xpMultipliers.totalMultiplier);

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
      const derivedBiomes = getBiomesForQuestion(question, activePack);
      const genusEntry =
        question.bonne_reponse?.ancestors?.find((ancestor) => ancestor.rank === 'genus') || null;
      const fallbackImageUrl =
        question.bonne_reponse?.default_photo?.square_url ||
        question.bonne_reponse?.default_photo?.url ||
        question.bonne_reponse?.photos?.[0]?.square_url ||
        question.bonne_reponse?.photos?.[0]?.url ||
        question.image_urls?.[0] ||
        null;
      const taxonPayload = {
        ...question.bonne_reponse,
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
        name: question.bonne_reponse.name,
        preferred_common_name: question.bonne_reponse.preferred_common_name,
        common_name: question.bonne_reponse.preferred_common_name || question.bonne_reponse.common_name,
        wikipedia_url: question.bonne_reponse.wikipedia_url,
        inaturalist_url: question.inaturalist_url,
        observations_count: question.bonne_reponse.observations_count ?? null,
        rarity_tier: taxonPayload.rarity_tier || null,
        conservation_status: question.bonne_reponse.conservation_status ?? null,
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
        multiplierApplied: xpMultipliers?.totalMultiplier ?? 1.0,
      };
      if (addSpeciesToCollection) {
        void addSpeciesToCollection(taxonPayload, isCorrectFinal, fallbackImageUrl);
      }
      const nextSpeciesData = [...sessionSpeciesData, speciesEntry];
      const consecutiveFastAnswers = (() => {
        let count = 0;
        for (let i = nextSpeciesData.length - 1; i >= 0; i -= 1) {
          const entry = nextSpeciesData[i];
          if (!entry?.wasCorrect) break;
          if (typeof entry.responseTimeMs !== 'number' || entry.responseTimeMs > LIGHTNING_THRESHOLD_MS) break;
          count += 1;
        }
        return count;
      })();
      const hintsUsedInSession = nextSpeciesData.filter((entry) => entry?.hintsUsed).length;
      const correctAnswersInSession = nextSpeciesData.filter((entry) => entry?.wasCorrect).length;
      const shieldsUsedInSession = nextSpeciesData.filter((entry) => !entry?.wasCorrect).length;

      const microUnlocks = evaluateMicroChallenges(
        {
          currentStreak: newStreak,
          roundMeta: roundDetails,
          sessionSpeciesData: nextSpeciesData,
          consecutiveFastAnswers,
          sessionXP: updatedScore,
          totalQuestionsAnswered: nextSpeciesData.length,
          hintsUsedInSession,
          correctAnswersInSession,
          shieldsUsed: shieldsUsedInSession,
          gameMode,
        },
        profile?.achievements || []
      );
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
