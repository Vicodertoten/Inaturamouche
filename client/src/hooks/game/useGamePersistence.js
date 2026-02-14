import { useCallback, useEffect } from 'react';
import { active_session } from '../../services/db';
import { DEFAULT_MAX_QUESTIONS, DEFAULT_MEDIA_TYPE, normalizeGameMode } from './gameUtils';
import { debugError, debugLog } from '../../utils/logger';
import { isDailySeedStale, isDailyCompleted } from '../../utils/dailyChallenge';

export function useGamePersistence({
  isGameActive,
  questionCount,
  question,
  score,
  sessionStats,
  sessionCorrectSpecies,
  sessionSpeciesData,
  sessionMissedSpecies,
  currentStreak,
  longestStreak,
  inGameShields,
  hasPermanentShield,
  nextQuestion,
  activePackId,
  customFilters,
  gameMode,
  maxQuestions,
  mediaType,
  dailySeed,
  dailySeedSession,
  isReviewMode,
  reviewTaxonIds,
  setActivePackId,
  dispatchCustomFilters,
  setGameMode,
  setMaxQuestions,
  setMediaType,
  setDailySeed,
  setDailySeedSession,
  setIsReviewMode,
  setReviewTaxonIds,
  setQuestionCount,
  setScore,
  setSessionStats,
  setSessionCorrectSpecies,
  setSessionSpeciesData,
  setSessionMissedSpecies,
  setCurrentStreak,
  setLongestStreak,
  setInGameShields,
  setHasPermanentShield,
  setIsGameActive,
  setIsGameOver,
  setQuestion,
  setNextQuestion,
  questionStartTimeRef,
}) {
  const clearSessionFromDB = useCallback(async () => {
    try {
      await active_session.delete(1);
      debugLog('[GameContext] Active session cleared from DB');
    } catch (err) {
      debugError('[GameContext] Failed to clear active session:', err);
    }
  }, []);

  const pauseGame = useCallback(async () => {
    if (!isGameActive) return;

    const sessionData = {
      id: 1,
      currentQuestionIndex: questionCount,
      currentQuestion: question,
      score,
      sessionStats,
      sessionCorrectSpecies,
      sessionSpeciesData,
      sessionMissedSpecies,
      currentStreak,
      longestStreak,
      inGameShields,
      hasPermanentShield,
      questionStartTime: questionStartTimeRef.current,
      nextQuestion,
      gameConfig: {
        activePackId,
        customFilters,
        gameMode,
        maxQuestions,
        mediaType,
        dailySeed,
        dailySeedSession,
        isReviewMode,
        reviewTaxonIds,
      },
      timestamp: Date.now(),
    };

    try {
      await active_session.put(sessionData);
      debugLog('[GameContext] Session paused and saved');
    } catch (err) {
      debugError('[GameContext] Failed to pause game session:', err);
    }
  }, [
    isGameActive,
    questionCount,
    question,
    score,
    sessionStats,
    sessionCorrectSpecies,
    sessionSpeciesData,
    sessionMissedSpecies,
    currentStreak,
    longestStreak,
    inGameShields,
    hasPermanentShield,
    nextQuestion,
    activePackId,
    customFilters,
    gameMode,
    maxQuestions,
    mediaType,
    dailySeed,
    dailySeedSession,
    isReviewMode,
    reviewTaxonIds,
    questionStartTimeRef,
  ]);

  const resumeGame = useCallback(async () => {
    try {
      debugLog('[GameContext] resumeGame() - Starting restoration');
      const sessionData = await active_session.get(1);
      if (!sessionData) {
        debugLog('[GameContext] No active session found');
        return null;
      }

      // Reject stale or already-completed daily challenge sessions
      const savedDailySeed = sessionData.gameConfig?.dailySeed;
      if (savedDailySeed) {
        if (isDailySeedStale(savedDailySeed)) {
          debugLog('[GameContext] Discarding stale daily session (seed: %s)', savedDailySeed);
          await active_session.delete(1);
          return null;
        }
        if (isDailyCompleted(savedDailySeed)) {
          debugLog('[GameContext] Daily challenge already completed (seed: %s)', savedDailySeed);
          await active_session.delete(1);
          return null;
        }
      }

      debugLog('[GameContext] Session resumed from DB', {
        currentQuestionIndex: sessionData.currentQuestionIndex,
        score: sessionData.score,
        gameConfig: sessionData.gameConfig,
      });

      const config = sessionData.gameConfig || {};
      debugLog('[GameContext] Restoring config');

      setActivePackId(config.activePackId || 'custom');
      if (config.customFilters) dispatchCustomFilters({ type: 'RESTORE', payload: config.customFilters });
      setGameMode(normalizeGameMode(config.gameMode, 'easy'));
      setMaxQuestions(config.maxQuestions ?? DEFAULT_MAX_QUESTIONS);
      setMediaType(config.mediaType || DEFAULT_MEDIA_TYPE);
      setDailySeed(config.dailySeed || null);
      setDailySeedSession(config.dailySeedSession || null);
      setIsReviewMode(config.isReviewMode || false);
      setReviewTaxonIds(config.reviewTaxonIds || []);

      setQuestionCount(sessionData.currentQuestionIndex || 0);
      setScore(sessionData.score || 0);
      setSessionStats(sessionData.sessionStats || { correctAnswers: 0 });
      setSessionCorrectSpecies(sessionData.sessionCorrectSpecies || []);
      setSessionSpeciesData(sessionData.sessionSpeciesData || []);
      setSessionMissedSpecies(sessionData.sessionMissedSpecies || []);
      setCurrentStreak(sessionData.currentStreak || 0);
      setLongestStreak(sessionData.longestStreak || 0);
      setInGameShields(sessionData.inGameShields || 0);
      setHasPermanentShield(sessionData.hasPermanentShield || false);

      if (typeof sessionData.questionStartTime === 'number') {
        questionStartTimeRef.current = sessionData.questionStartTime;
      }

      debugLog('[GameContext] About to set isGameActive to true');
      setIsGameActive(true);
      setIsGameOver(false);
      setQuestion(sessionData.currentQuestion || null);
      setNextQuestion(sessionData.nextQuestion || null);

      debugLog('[GameContext] resumeGame() - Restoration complete');
      return sessionData;
    } catch (err) {
      debugError('[GameContext] Failed to resume game session:', err);
      return null;
    }
  }, [
    dispatchCustomFilters,
    setActivePackId,
    setGameMode,
    setMaxQuestions,
    setMediaType,
    setDailySeed,
    setDailySeedSession,
    setIsReviewMode,
    setReviewTaxonIds,
    setQuestionCount,
    setScore,
    setSessionStats,
    setSessionCorrectSpecies,
    setSessionSpeciesData,
    setSessionMissedSpecies,
    setCurrentStreak,
    setLongestStreak,
    setInGameShields,
    setHasPermanentShield,
    setIsGameActive,
    setIsGameOver,
    setQuestion,
    setNextQuestion,
    questionStartTimeRef,
  ]);

  useEffect(() => {
    return () => {
      if (isGameActive) {
        pauseGame().catch((err) => debugError('[GameContext] Error pausing game on unmount:', err));
      }
    };
  }, [isGameActive, pauseGame]);

  useEffect(() => {
    const handleBeforeUnload = async (e) => {
      if (isGameActive) {
        await pauseGame();
        e.preventDefault();
        e.returnValue = '';
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', handleBeforeUnload);
      return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }
  }, [isGameActive, pauseGame]);

  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.hidden && isGameActive) {
        await pauseGame();
        debugLog('[GameContext] Session paused due to visibility change');
      }
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
      return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }
  }, [isGameActive, pauseGame]);

  return {
    clearSessionFromDB,
    pauseGame,
    resumeGame,
  };
}
