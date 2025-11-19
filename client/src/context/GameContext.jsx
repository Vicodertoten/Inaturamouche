import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';
import PACKS from '../../../shared/packs.js';
import { checkNewAchievements } from '../achievements';
import { initialCustomFilters, customFilterReducer } from '../state/filterReducer';
import { fetchQuizQuestion } from '../services/api';
import { loadProfileWithDefaults } from '../services/PlayerProfile';
import { useUser } from './UserContext';
import { useLanguage } from './LanguageContext.jsx';

export const MAX_QUESTIONS_PER_GAME = 5;

const GameContext = createContext(null);

export function GameProvider({ children }) {
  const { profile, updateProfile, queueAchievements } = useUser();
  const { language, t } = useLanguage();

  const [activePackId, setActivePackId] = useState('custom');
  const [customFilters, dispatchCustomFilters] = useReducer(customFilterReducer, initialCustomFilters);
  const [gameMode, setGameMode] = useState('easy');
  const [isGameActive, setIsGameActive] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);
  const [question, setQuestion] = useState(null);
  const [nextQuestion, setNextQuestion] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [questionCount, setQuestionCount] = useState(0);
  const [score, setScore] = useState(0);
  const [sessionStats, setSessionStats] = useState({ correctAnswers: 0 });
  const [sessionCorrectSpecies, setSessionCorrectSpecies] = useState([]);
  const [sessionSpeciesData, setSessionSpeciesData] = useState([]);
  const [sessionMissedSpecies, setSessionMissedSpecies] = useState([]);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [isReviewMode, setIsReviewMode] = useState(false);
  const [newlyUnlocked, setNewlyUnlocked] = useState([]);

  const achievementsTimerRef = useRef(null);
  const activeRequestController = useRef(null);
  const prefetchRequestController = useRef(null);

  useEffect(() => {
    return () => {
      if (achievementsTimerRef.current) clearTimeout(achievementsTimerRef.current);
      activeRequestController.current?.abort();
      prefetchRequestController.current?.abort();
    };
  }, []);

  const clearAchievementsTimer = useCallback(() => {
    if (achievementsTimerRef.current) {
      clearTimeout(achievementsTimerRef.current);
      achievementsTimerRef.current = null;
    }
  }, []);

  const abortActiveFetch = useCallback(() => {
    if (activeRequestController.current) {
      activeRequestController.current.abort();
      activeRequestController.current = null;
    }
  }, []);

  const abortPrefetchFetch = useCallback(() => {
    if (prefetchRequestController.current) {
      prefetchRequestController.current.abort();
      prefetchRequestController.current = null;
    }
  }, []);

  const resetSessionState = useCallback(() => {
    setScore(0);
    setSessionStats({ correctAnswers: 0 });
    setSessionCorrectSpecies([]);
    setSessionSpeciesData([]);
    setSessionMissedSpecies([]);
    setCurrentStreak(0);
    setNewlyUnlocked([]);
    clearAchievementsTimer();
  }, [clearAchievementsTimer]);

  const resetToLobby = useCallback(
    (clearSession = true) => {
      abortActiveFetch();
      abortPrefetchFetch();
      setIsGameActive(false);
      setIsGameOver(false);
      setQuestionCount(0);
      setQuestion(null);
      setNextQuestion(null);
      setError(null);
      setIsReviewMode(false);
      if (clearSession) resetSessionState();
    },
    [abortActiveFetch, abortPrefetchFetch, resetSessionState]
  );

  const clearError = useCallback(() => setError(null), []);

  const updateScore = useCallback((delta) => {
    setScore((prev) => prev + delta);
  }, []);

  const buildQuizParams = useCallback(() => {
    const params = new URLSearchParams();
    params.set('locale', language);

    if (isReviewMode) {
      (profile?.stats?.missedSpecies || []).forEach((id) => params.append('taxon_ids', id));
      return params;
    }

    const activePack = PACKS.find((p) => p.id === activePackId);
    if (activePack?.type === 'list') {
      activePack.taxa_ids.forEach((id) => params.append('taxon_ids', id));
    } else if (activePack?.type === 'dynamic') {
      params.set('pack_id', activePack.id);
    } else {
      customFilters.includedTaxa.forEach((taxon) => params.append('include_taxa', taxon.id));
      customFilters.excludedTaxa.forEach((taxon) => params.append('exclude_taxa', taxon.id));

      if (customFilters.place_enabled) {
        const g = customFilters.geo;
        if (g.mode === 'place' && g.place_id) {
          params.set('place_id', g.place_id);
        } else if (
          g.mode === 'map' &&
          [g.nelat, g.nelng, g.swlat, g.swlng].every((value) => value != null)
        ) {
          params.set('nelat', g.nelat);
          params.set('nelng', g.nelng);
          params.set('swlat', g.swlat);
          params.set('swlng', g.swlng);
        }
      }

      if (customFilters.date_enabled) {
        if (customFilters.d1) params.set('d1', customFilters.d1);
        if (customFilters.d2) params.set('d2', customFilters.d2);
      }
    }
    return params;
  }, [activePackId, customFilters, isReviewMode, language, profile?.stats?.missedSpecies]);

  const fetchQuestion = useCallback(
    async (prefetchOnly = false) => {
      if (prefetchOnly) {
        abortPrefetchFetch();
      } else {
        abortActiveFetch();
        setLoading(true);
        setError(null);
      }

      const controller = new AbortController();
      if (prefetchOnly) {
        prefetchRequestController.current = controller;
      } else {
        activeRequestController.current = controller;
      }

      try {
        const params = buildQuizParams();
        const questionData = await fetchQuizQuestion(params, { signal: controller.signal });

        if (prefetchOnly) {
          setNextQuestion(questionData);
        } else {
          setQuestion(questionData);
          fetchQuestion(true);
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        if (!prefetchOnly) {
          const message =
            err.status === 404 || err.status === 500 ? t('errors.quiz_no_results') : err.message || t('errors.generic');
          setError(message);
          setIsGameActive(false);
          setIsGameOver(false);
          setQuestionCount(0);
        }
      } finally {
        if (!prefetchOnly) {
          setLoading(false);
          if (activeRequestController.current === controller) {
            activeRequestController.current = null;
          }
        } else if (prefetchRequestController.current === controller) {
          prefetchRequestController.current = null;
        }
      }
    },
    [abortActiveFetch, abortPrefetchFetch, buildQuizParams, t]
  );

  useEffect(() => {
    if (isGameActive && !question && questionCount > 0 && !loading) {
      fetchQuestion();
    }
  }, [fetchQuestion, isGameActive, loading, question, questionCount]);

  const startGame = useCallback(
    ({ review = false } = {}) => {
      resetSessionState();
      setQuestion(null);
      setNextQuestion(null);
      setError(null);
      setQuestionCount(1);
      setIsGameActive(true);
      setIsGameOver(false);
      setIsReviewMode(review);
    },
    [resetSessionState]
  );

  const nextImageUrl = useMemo(() => {
    if (!nextQuestion) return null;
    return nextQuestion.image_urls?.[0] || nextQuestion.image_url || null;
  }, [nextQuestion]);

  const clearUnlockedLater = useCallback(() => {
    clearAchievementsTimer();
    achievementsTimerRef.current = setTimeout(() => setNewlyUnlocked([]), 5000);
  }, [clearAchievementsTimer]);

  const finalizeGame = useCallback(
    ({ finalCorrectAnswers, finalScore, finalCorrectSpecies, finalMissedSpecies }) => {
      const profileClone = profile
        ? JSON.parse(JSON.stringify(profile))
        : loadProfileWithDefaults();

      profileClone.xp = (profileClone.xp || 0) + finalScore;
      profileClone.stats.gamesPlayed = (profileClone.stats.gamesPlayed || 0) + 1;

      if (gameMode === 'easy') {
        profileClone.stats.correctEasy = (profileClone.stats.correctEasy || 0) + finalCorrectAnswers;
        profileClone.stats.easyQuestionsAnswered =
          (profileClone.stats.easyQuestionsAnswered || 0) + MAX_QUESTIONS_PER_GAME;
        profileClone.stats.accuracyEasy = profileClone.stats.easyQuestionsAnswered > 0
          ? profileClone.stats.correctEasy / profileClone.stats.easyQuestionsAnswered
          : 0;
      } else {
        profileClone.stats.correctHard = (profileClone.stats.correctHard || 0) + finalCorrectAnswers;
        profileClone.stats.hardQuestionsAnswered =
          (profileClone.stats.hardQuestionsAnswered || 0) + MAX_QUESTIONS_PER_GAME;
        profileClone.stats.accuracyHard = profileClone.stats.hardQuestionsAnswered > 0
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
      profileClone.stats.packsPlayed[activePackId].answered += MAX_QUESTIONS_PER_GAME;

      const unlocked = checkNewAchievements(profileClone);
      if (unlocked.length > 0) {
        profileClone.achievements = Array.from(
          new Set([...(profileClone.achievements || []), ...unlocked])
        );
        queueAchievements(unlocked);
        setNewlyUnlocked(unlocked);
        clearUnlockedLater();
      } else {
        setNewlyUnlocked([]);
        clearAchievementsTimer();
      }

      updateProfile(profileClone);
      setIsGameActive(false);
      setIsGameOver(true);
      setNextQuestion(null);
    },
    [activePackId, clearAchievementsTimer, clearUnlockedLater, gameMode, profile, queueAchievements, updateProfile]
  );

  const completeRound = useCallback(
    ({ points = 0, bonus = 0, streakBonus = 0, isCorrect = null } = {}) => {
      if (!question) return;

      const currentQuestionId = question.bonne_reponse.id;
      const isCorrectFinal = typeof isCorrect === 'boolean' ? isCorrect : points > 0;
      const newStreak = isCorrectFinal ? currentStreak + 1 : 0;
      setCurrentStreak(newStreak);

      const totalBonus = (bonus || 0) + (streakBonus || 0);
      const updatedScore = score + points + totalBonus;
      setScore(updatedScore);

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
        bonus: totalBonus,
        streak: newStreak,
      };
      const nextSpeciesData = [...sessionSpeciesData, speciesEntry];

      setSessionStats({ correctAnswers: finalCorrectAnswers });
      setSessionCorrectSpecies(finalCorrectSpecies);
      setSessionMissedSpecies(finalMissedSpecies);
      setSessionSpeciesData(nextSpeciesData);

      if (questionCount < MAX_QUESTIONS_PER_GAME) {
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
        });
      }
    },
    [
      currentStreak,
      fetchQuestion,
      finalizeGame,
      nextQuestion,
      question,
      questionCount,
      score,
      sessionCorrectSpecies,
      sessionMissedSpecies,
      sessionSpeciesData,
      sessionStats.correctAnswers,
    ]
  );

  const canStartReview = (profile?.stats?.missedSpecies?.length || 0) >= MAX_QUESTIONS_PER_GAME;

  const value = {
    activePackId,
    setActivePackId,
    customFilters,
    dispatchCustomFilters,
    gameMode,
    setGameMode,
    isGameActive,
    isGameOver,
    question,
    nextQuestion,
    loading,
    error,
    clearError,
    questionCount,
    score,
    sessionStats,
    sessionCorrectSpecies,
    sessionSpeciesData,
    sessionMissedSpecies,
    currentStreak,
    newlyUnlocked,
    nextImageUrl,
    updateScore,
    completeRound,
    startGame,
    resetToLobby,
    canStartReview,
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame() {
  const context = useContext(GameContext);
  if (!context) throw new Error('useGame must be used within a GameProvider');
  return context;
}
