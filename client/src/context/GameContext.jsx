/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo } from 'react';
import { useUser } from './UserContext';
import { useLanguage } from './LanguageContext.jsx';
import { usePacks } from './PacksContext.jsx';
import { useGameMetaStore, calculateXPMultipliers } from '../state/gameMetaStore';
import { useGameConfigState } from '../hooks/game/useGameConfigState';
import { useGameSessionState } from '../hooks/game/useGameSessionState';
import { useGameRequests } from '../hooks/game/useGameRequests';
import { useGamePersistence } from '../hooks/game/useGamePersistence';
import { useGameActions } from '../hooks/game/useGameActions';
import { useGameProfileSync } from '../hooks/game/useGameProfileSync';
import { useGameNextImage } from '../hooks/game/useGameNextImage';
import { DEFAULT_MAX_QUESTIONS } from '../hooks/game/gameUtils';

export { DEFAULT_MAX_QUESTIONS } from '../hooks/game/gameUtils';

const GameDataContext = createContext(null);
const GameUIContext = createContext(null);

export function GameProvider({ children }) {
  const { profile, updateProfile, queueAchievements, recordEncounter } = useUser();
  const { language, t, nameFormat } = useLanguage();
  const { packs, loading: packsLoading } = usePacks();

  const gameConfig = useGameConfigState({ packs, packsLoading });
  const gameSession = useGameSessionState();
  const {
    isStartingNewGame,
    question: currentQuestion,
    error: currentError,
    setIsStartingNewGame,
    setError,
  } = gameSession;

  // Zustand store — replaces XPContext, StreakContext, AchievementContext
  const recentXPGain = useGameMetaStore((s) => s.recentXPGain);
  const setRecentXPGain = useGameMetaStore((s) => s.setRecentXPGain);
  const initialSessionXP = useGameMetaStore((s) => s.initialSessionXP);
  const setInitialSessionXP = useGameMetaStore((s) => s.setInitialSessionXP);
  const levelUpNotification = useGameMetaStore((s) => s.levelUpNotification);
  const setLevelUpNotification = useGameMetaStore((s) => s.setLevelUpNotification);

  const currentStreak = useGameMetaStore((s) => s.currentStreak);
  const setCurrentStreak = useGameMetaStore((s) => s.setCurrentStreak);
  const longestStreak = useGameMetaStore((s) => s.longestStreak);
  const setLongestStreak = useGameMetaStore((s) => s.setLongestStreak);
  const inGameShields = useGameMetaStore((s) => s.inGameShields);
  const setInGameShields = useGameMetaStore((s) => s.setInGameShields);
  const hasPermanentShield = useGameMetaStore((s) => s.hasPermanentShield);
  const setHasPermanentShield = useGameMetaStore((s) => s.setHasPermanentShield);

  const newlyUnlocked = useGameMetaStore((s) => s.newlyUnlocked);
  const setNewlyUnlocked = useGameMetaStore((s) => s.setNewlyUnlocked);
  const clearAchievementsTimer = useGameMetaStore((s) => s.clearAchievementsTimer);
  const clearUnlockedLater = useGameMetaStore((s) => s.clearUnlockedLater);

  useGameProfileSync({
    profile,
    setHasPermanentShield,
    setInitialSessionXP,
  });

  const {
    abortActiveFetch,
    abortPrefetchFetch,
    fetchQuestion,
    questionStartTimeRef,
  } = useGameRequests({
    activePack: gameConfig.activePack,
    customFilters: gameConfig.customFilters,
    isReviewMode: gameConfig.isReviewMode,
    reviewTaxonIds: gameConfig.reviewTaxonIds,
    language,
    mediaType: gameConfig.mediaType,
    gameMode: gameConfig.gameMode,
    dailySeed: gameConfig.dailySeed,
    dailySeedSession: gameConfig.dailySeedSession,
    profileMissedSpecies: profile?.stats?.missedSpecies,
    t,
    isGameActive: gameSession.isGameActive,
    question: gameSession.question,
    questionCount: gameSession.questionCount,
    loading: gameSession.loading,
    setLoading: gameSession.setLoading,
    setError: gameSession.setError,
    setIsGameActive: gameSession.setIsGameActive,
    setIsGameOver: gameSession.setIsGameOver,
    setQuestionCount: gameSession.setQuestionCount,
    setQuestion: gameSession.setQuestion,
    setNextQuestion: gameSession.setNextQuestion,
  });

  const { clearSessionFromDB, pauseGame, resumeGame } = useGamePersistence({
    isGameActive: gameSession.isGameActive,
    questionCount: gameSession.questionCount,
    question: gameSession.question,
    score: gameSession.score,
    sessionStats: gameSession.sessionStats,
    sessionCorrectSpecies: gameSession.sessionCorrectSpecies,
    sessionSpeciesData: gameSession.sessionSpeciesData,
    sessionMissedSpecies: gameSession.sessionMissedSpecies,
    currentStreak,
    longestStreak,
    inGameShields,
    hasPermanentShield,
    nextQuestion: gameSession.nextQuestion,
    activePackId: gameConfig.activePackId,
    customFilters: gameConfig.customFilters,
    gameMode: gameConfig.gameMode,
    maxQuestions: gameConfig.maxQuestions,
    mediaType: gameConfig.mediaType,
    dailySeed: gameConfig.dailySeed,
    dailySeedSession: gameConfig.dailySeedSession,
    isReviewMode: gameConfig.isReviewMode,
    reviewTaxonIds: gameConfig.reviewTaxonIds,
    setActivePackId: gameConfig.setActivePackId,
    dispatchCustomFilters: gameConfig.dispatchCustomFilters,
    setGameMode: gameConfig.setGameMode,
    setMaxQuestions: gameConfig.setMaxQuestions,
    setMediaType: gameConfig.setMediaType,
    setDailySeed: gameConfig.setDailySeed,
    setDailySeedSession: gameConfig.setDailySeedSession,
    setIsReviewMode: gameConfig.setIsReviewMode,
    setReviewTaxonIds: gameConfig.setReviewTaxonIds,
    setQuestionCount: gameSession.setQuestionCount,
    setScore: gameSession.setScore,
    setSessionStats: gameSession.setSessionStats,
    setSessionCorrectSpecies: gameSession.setSessionCorrectSpecies,
    setSessionSpeciesData: gameSession.setSessionSpeciesData,
    setSessionMissedSpecies: gameSession.setSessionMissedSpecies,
    setCurrentStreak,
    setLongestStreak,
    setInGameShields,
    setHasPermanentShield,
    setIsGameActive: gameSession.setIsGameActive,
    setIsGameOver: gameSession.setIsGameOver,
    setQuestion: gameSession.setQuestion,
    setNextQuestion: gameSession.setNextQuestion,
    questionStartTimeRef,
  });

  const {
    resetToLobby,
    updateScore,
    startGame,
    startReviewMode,
    completeRound,
    endGame,
    triggerRarityCelebration,
  } = useGameActions({
    profile,
    updateProfile,
    queueAchievements,
    addSpeciesToCollection: recordEncounter,
    activePackId: gameConfig.activePackId,
    activePack: gameConfig.activePack,
    gameMode: gameConfig.gameMode,
    maxQuestions: gameConfig.maxQuestions,
    mediaType: gameConfig.mediaType,
    isReviewMode: gameConfig.isReviewMode,
    setGameMode: gameConfig.setGameMode,
    setMaxQuestions: gameConfig.setMaxQuestions,
    setMediaType: gameConfig.setMediaType,
    setIsReviewMode: gameConfig.setIsReviewMode,
    setReviewTaxonIds: gameConfig.setReviewTaxonIds,
    setDailySeed: gameConfig.setDailySeed,
    setDailySeedSession: gameConfig.setDailySeedSession,
    setIsChallenge: gameConfig.setIsChallenge,
    isGameActive: gameSession.isGameActive,
    setIsGameActive: gameSession.setIsGameActive,
    setIsStartingNewGame: gameSession.setIsStartingNewGame,
    setIsGameOver: gameSession.setIsGameOver,
    question: gameSession.question,
    setQuestion: gameSession.setQuestion,
    nextQuestion: gameSession.nextQuestion,
    setNextQuestion: gameSession.setNextQuestion,
    questionCount: gameSession.questionCount,
    setQuestionCount: gameSession.setQuestionCount,
    score: gameSession.score,
    setScore: gameSession.setScore,
    sessionStats: gameSession.sessionStats,
    setSessionStats: gameSession.setSessionStats,
    sessionCorrectSpecies: gameSession.sessionCorrectSpecies,
    setSessionCorrectSpecies: gameSession.setSessionCorrectSpecies,
    sessionSpeciesData: gameSession.sessionSpeciesData,
    setSessionSpeciesData: gameSession.setSessionSpeciesData,
    sessionMissedSpecies: gameSession.sessionMissedSpecies,
    setSessionMissedSpecies: gameSession.setSessionMissedSpecies,
    setError: gameSession.setError,
    setLoading: gameSession.setLoading,
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
    nameFormat,
    clearAchievementsTimer,
    clearUnlockedLater,
    setRarityCelebration: gameSession.setRarityCelebration,
  });

  const { nextImageUrl } = useGameNextImage({
    mediaType: gameConfig.mediaType,
    nextQuestion: gameSession.nextQuestion,
  });

  useEffect(() => {
    if (isStartingNewGame && (currentQuestion || currentError)) {
      setIsStartingNewGame(false);
    }
  }, [currentError, currentQuestion, isStartingNewGame, setIsStartingNewGame]);

  const clearError = useCallback(() => setError(null), [setError]);

  const currentMultiplier = 1.0;
  const canStartReview = (profile?.stats?.missedSpecies?.length || 0) >= DEFAULT_MAX_QUESTIONS;

  const dataValue = useMemo(
    () => ({
      activePackId: gameConfig.activePackId,
      setActivePackId: gameConfig.setActivePackId,
      customFilters: gameConfig.customFilters,
      dispatchCustomFilters: gameConfig.dispatchCustomFilters,
      gameMode: gameConfig.gameMode,
      setGameMode: gameConfig.setGameMode,
      isGameActive: gameSession.isGameActive,
      isStartingNewGame: gameSession.isStartingNewGame,
      isGameOver: gameSession.isGameOver,
      question: gameSession.question,
      nextQuestion: gameSession.nextQuestion,
      questionCount: gameSession.questionCount,
      maxQuestions: gameConfig.maxQuestions,
      setMaxQuestions: gameConfig.setMaxQuestions,
      mediaType: gameConfig.mediaType,
      setMediaType: gameConfig.setMediaType,
      dailySeed: gameConfig.dailySeed,
      dailySeedSession: gameConfig.dailySeedSession,
      isChallenge: gameConfig.isChallenge,
      score: gameSession.score,
      sessionStats: gameSession.sessionStats,
      sessionCorrectSpecies: gameSession.sessionCorrectSpecies,
      sessionSpeciesData: gameSession.sessionSpeciesData,
      sessionMissedSpecies: gameSession.sessionMissedSpecies,
      rarityCelebration: gameSession.rarityCelebration,
      setRarityCelebration: gameSession.setRarityCelebration,
      isReviewMode: gameConfig.isReviewMode,
      reviewTaxonIds: gameConfig.reviewTaxonIds,
      currentStreak,
      longestStreak,
      inGameShields,
      hasPermanentShield,
      currentMultiplier,
      newlyUnlocked,
      nextImageUrl,
      recentXPGain,
      initialSessionXP,
      levelUpNotification,
      xpMultipliers: calculateXPMultipliers(profile, currentStreak),
      updateScore,
      completeRound,
      endGame,
      startGame,
      startReviewMode,
      triggerRarityCelebration,
      resetToLobby,
      canStartReview,
      pauseGame,
      resumeGame,
      clearSessionFromDB,
    }),
    [
      canStartReview,
      clearSessionFromDB,
      completeRound,
      currentMultiplier,
      currentStreak,
      endGame,
      gameConfig.activePackId,
      gameConfig.customFilters,
      gameConfig.dailySeed,
      gameConfig.dailySeedSession,
      gameConfig.dispatchCustomFilters,
      gameConfig.gameMode,
      gameConfig.isChallenge,
      gameConfig.isReviewMode,
      gameConfig.maxQuestions,
      gameConfig.mediaType,
      gameConfig.reviewTaxonIds,
      gameConfig.setActivePackId,
      gameConfig.setGameMode,
      gameConfig.setMaxQuestions,
      gameConfig.setMediaType,
      gameSession.isGameActive,
      gameSession.isGameOver,
      gameSession.isStartingNewGame,
      gameSession.nextQuestion,
      gameSession.question,
      gameSession.questionCount,
      gameSession.score,
      gameSession.sessionCorrectSpecies,
      gameSession.sessionMissedSpecies,
      gameSession.sessionSpeciesData,
      gameSession.sessionStats,
      gameSession.rarityCelebration,
      gameSession.setRarityCelebration,
      hasPermanentShield,
      inGameShields,
      initialSessionXP,
      levelUpNotification,
      longestStreak,
      newlyUnlocked,
      nextImageUrl,
      pauseGame,
      profile,
      recentXPGain,
      resetToLobby,
      resumeGame,
      startGame,
      startReviewMode,
      triggerRarityCelebration,
      updateScore,
    ]
  );

  const uiValue = useMemo(
    () => ({
      loading: gameSession.loading,
      error: gameSession.error,
      clearError,
    }),
    [clearError, gameSession.error, gameSession.loading]
  );

  return (
    <GameUIContext.Provider value={uiValue}>
      <GameDataContext.Provider value={dataValue}>{children}</GameDataContext.Provider>
    </GameUIContext.Provider>
  );
}

export function useGameData() {
  const context = useContext(GameDataContext);
  if (!context) throw new Error('useGameData must be used within a GameProvider');
  return context;
}

export function useGameUI() {
  const context = useContext(GameUIContext);
  if (!context) throw new Error('useGameUI must be used within a GameProvider');
  return context;
}

export function useGame() {
  return { ...useGameData(), ...useGameUI() };
}
