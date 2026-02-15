import { useCallback } from 'react';
import { loadProfileWithDefaults } from '../../services/PlayerProfile';
import { notify } from '../../services/notifications';
import { getLevelFromXp } from '../../utils/scoring';
import { getRarityInfo } from '../../utils/rarityUtils';
import { computeRoundEconomy } from '../../utils/economy';
import { evaluateMicroChallenges } from '../../core/achievements';
import { getBiomesForQuestion, hasQuestionLimit } from './gameUtils';

const LIGHTNING_THRESHOLD_MS = 1500;

/**
 * Round-level scoring: XP, streaks, rarity celebrations, micro-achievements.
 */
export function useGameScoring({
  profile,
  updateProfile,
  queueAchievements,
  recordEncounter,
  activePack,
  gameMode,
  maxQuestions,
  isReviewMode,
  question,
  nextQuestion,
  questionCount,
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
  fetchQuestion,
  setQuestion,
  setNextQuestion,
  setQuestionCount,
  questionStartTimeRef,
  currentStreak,
  setCurrentStreak,
  longestStreak,
  setLongestStreak,
  inGameShields,
  setInGameShields,
  setRecentXPGain,
  setLevelUpNotification,
  calculateXPMultipliers,
  setRarityCelebration,
  // injected from useGameRewards
  finalizeGame,
}) {
  const triggerRarityCelebration = useCallback(
    (tier) => {
      if (!setRarityCelebration || !tier) return;
      setRarityCelebration({ tier, stamp: Date.now() });
    },
    [setRarityCelebration]
  );

  const updateScore = useCallback((delta) => {
    setScore((prev) => prev + delta);
  }, [setScore]);

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

      // ── Streak logic ──
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

      // ── Economy ──
      const isValidatedRoundEvent = roundMeta?.serverValidated === true;
      const modeForRound = roundMeta.mode || gameMode;

      // ── Rarity ──
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

      // Single economy computation (includes rarity from the start)
      const roundEconomy = computeRoundEconomy({
        isCorrect: isCorrectFinal,
        points,
        bonus,
        streakBonus,
        rarityBonusXp,
      });

      // Score = XP (single source of truth)
      const updatedScore = score + roundEconomy.xp;
      setScore(updatedScore);

      const earnedXP = roundEconomy.xp;

      if (isReviewMode && earnedXP > 0 && questionCount === 1) {
        notify('📚 Mode Révision', {
          type: 'info',
          duration: 3000,
        });
      }

      if (earnedXP > 0) {
        setRecentXPGain(earnedXP);
        setTimeout(() => setRecentXPGain(0), 2000);

        updateProfile((prev) => {
          const base = prev ?? loadProfileWithDefaults();
          const oldXP = base.xp || 0;
          const newXP = oldXP + earnedXP;
          const oldLevel = getLevelFromXp(oldXP);
          const newLevel = getLevelFromXp(newXP);

          if (newLevel > oldLevel) {
            setLevelUpNotification({ oldLevel, newLevel, timestamp: Date.now() });
            setTimeout(() => setLevelUpNotification(null), 4000);
          }

          return { ...base, xp: newXP };
        });
      }

      // ── Build species entry ──
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
      const taxonPayload = { ...resolvedAnswer };
      if (!taxonPayload.rank) {
        taxonPayload.rank = 'species';
      }
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
        bonus: (bonus || 0) + (streakBonus || 0),
        streak: newStreak,
        biomes: derivedBiomes,
        responseTimeMs,
        genusId: genusEntry?.id || null,
        genusName: genusEntry?.name || null,
        wasCorrect: isCorrectFinal,
        validatedEvent: isValidatedRoundEvent,
        earnedXp: earnedXP,
        multiplierApplied: 1.0,
        economy: {
          scoreDelta: roundEconomy.scoreDelta,
          baseXp: roundEconomy.baseXp,
          streakBonus: roundEconomy.streakBonus,
          rarityBonus: roundEconomy.rarityBonus,
          xp: roundEconomy.xp,
        },
      };

      if (recordEncounter) {
        void recordEncounter(taxonPayload, isCorrectFinal, fallbackImageUrl);
      }

      // ── Micro-achievements ──
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
      const hintsUsedInSession = 0;
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
              roundMeta: { ...roundDetails, serverValidated: isValidatedRoundEvent },
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
          return { ...baseProfile, achievements: Array.from(existing) };
        });
        if (freshUnlocks.length) {
          queueAchievements(freshUnlocks);
        }
      }

      // ── Advance or finalize ──
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
      recordEncounter,
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

  return {
    updateScore,
    completeRound,
    triggerRarityCelebration,
  };
}
