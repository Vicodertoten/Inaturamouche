/* eslint-disable react-refresh/only-export-components */
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
import { 
  checkNewAchievements, 
  evaluateMicroChallenges,
  checkEndOfGameAchievements,
  applyAllRewards,
  getRewardForAchievement,
  REWARD_TYPES,
} from '../core/achievements';
import { initialCustomFilters, customFilterReducer } from '../state/filterReducer';
import { fetchQuizQuestion } from '../services/api';
import { loadProfileWithDefaults } from '../services/PlayerProfile';
import { updateDailyStreak } from '../services/StreakService';
import { getCollectionStatsForAchievements, updateWeekendStats } from '../services/AchievementStatsService';
import { active_session } from '../services/db';
import { useUser } from './UserContext';
import { useLanguage } from './LanguageContext.jsx';
import { usePacks } from './PacksContext.jsx';
import { getLevelFromXp } from '../utils/scoring';
import { useXP } from './XPContext.jsx';
import { useStreak } from './StreakContext.jsx';
import { useAchievement } from './AchievementContext.jsx';
import { preloadQuestionImages } from '../utils/imagePreload';
import { notify } from '../services/notifications.js';
import { getSpeciesDueForReview } from '../services/CollectionService.js';
import { notifyApiError } from '../services/api.js';

export const DEFAULT_MAX_QUESTIONS = 5;
const DEFAULT_MEDIA_TYPE = 'images';

const normalizeMaxQuestions = (value, fallback = DEFAULT_MAX_QUESTIONS) => {
  if (value === null || value === -1 || value === 'infinite') return null;
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.trunc(parsed);
};

const normalizeMediaType = (value, fallback = DEFAULT_MEDIA_TYPE) => {
  if (value === 'images' || value === 'sounds' || value === 'both') return value;
  return fallback;
};

const normalizeGameMode = (value, fallback = 'easy') => {
  if (value === 'easy' || value === 'hard' || value === 'riddle' || value === 'taxonomic') return value;
  return fallback;
};

const hasQuestionLimit = (value) => Number.isInteger(value) && value > 0;

const resolveTotalQuestions = (maxQuestions, questionCount) =>
  hasQuestionLimit(maxQuestions) ? maxQuestions : questionCount || 0;


const createSeedSessionId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const getBiomesForQuestion = (question, pack) => {
  if (Array.isArray(question?.biome_tags) && question.biome_tags.length > 0) {
    return question.biome_tags;
  }
  if (Array.isArray(question?.pack_context?.biomes) && question.pack_context.biomes.length > 0) {
    return question.pack_context.biomes;
  }
  if (Array.isArray(pack?.biomes) && pack.biomes.length > 0) {
    return pack.biomes;
  }
  if (pack?.biome) return [pack.biome];
  return [];
};

const GameDataContext = createContext(null);
const GameUIContext = createContext(null);

export function GameProvider({ children }) {
  const { profile, updateProfile, queueAchievements, addSpeciesToCollection } = useUser();
  const { language, t } = useLanguage();
  const { packs, loading: packsLoading } = usePacks();

  const [activePackId, setActivePackId] = useState('custom');
  const [customFilters, dispatchCustomFilters] = useReducer(customFilterReducer, initialCustomFilters);
  const [gameMode, setGameMode] = useState('easy');
  const [isGameActive, setIsGameActive] = useState(false);
  const [isStartingNewGame, setIsStartingNewGame] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);
  const [question, setQuestion] = useState(null);
  const [nextQuestion, setNextQuestion] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [questionCount, setQuestionCount] = useState(0);
  const [maxQuestions, setMaxQuestions] = useState(DEFAULT_MAX_QUESTIONS);
  const [mediaType, setMediaType] = useState(DEFAULT_MEDIA_TYPE);
  const [dailySeed, setDailySeed] = useState(null);
  const [dailySeedSession, setDailySeedSession] = useState(null);
  const [score, setScore] = useState(0);
  const [sessionStats, setSessionStats] = useState({ correctAnswers: 0 });
  const [sessionCorrectSpecies, setSessionCorrectSpecies] = useState([]);
  const [sessionSpeciesData, setSessionSpeciesData] = useState([]);
  const [sessionMissedSpecies, setSessionMissedSpecies] = useState([]);
  const [isReviewMode, setIsReviewMode] = useState(false);
  const [reviewTaxonIds, setReviewTaxonIds] = useState([]);

  // XP, streak and achievement state moved to separate contexts
  const {
    recentXPGain,
    setRecentXPGain,
    initialSessionXP,
    setInitialSessionXP,
    levelUpNotification,
    setLevelUpNotification,
    calculateXPMultipliers,
  } = useXP();

  const {
    currentStreak,
    setCurrentStreak,
    longestStreak,
    setLongestStreak,
    inGameShields,
    setInGameShields,
    hasPermanentShield,
    setHasPermanentShield,
  } = useStreak();

  const { newlyUnlocked, setNewlyUnlocked, clearAchievementsTimer, clearUnlockedLater } = useAchievement();
  const activePack = useMemo(
    () => {
      if (activePackId === 'review') {
        return {
          id: 'review',
          type: 'review',
          titleKey: 'common.review_mistakes',
          descriptionKey: 'home.learn_action_review',
        };
      }
      return packs.find((pack) => pack.id === activePackId);
    },
    [packs, activePackId]
  );

  useEffect(() => {
    if (!packsLoading && activePackId !== 'custom' && activePackId !== 'review' && !activePack) {
      setActivePackId('custom');
    }
  }, [activePack, activePackId, packsLoading]);

  const activeRequestController = useRef(null);
  const prefetchRequestController = useRef(null);
  const questionStartTimeRef = useRef(null);
  useEffect(() => {
    return () => {
      // controllers only; achievement timers are handled by AchievementProvider
      activeRequestController.current?.abort();
      prefetchRequestController.current?.abort();
    };
  }, []);

  useEffect(() => {
    // Initialize achievement-related state from profile
    // NOTE: In-game streak (combo) starts at 0 for each new game session
    // profile.stats.longestStreak is the ALL-TIME record, not session state
    if (profile) {
      setHasPermanentShield(profile?.achievements?.includes('STREAK_GUARDIAN') || false);
      setInitialSessionXP(profile?.xp || 0);
    }
  }, [profile, setHasPermanentShield, setInitialSessionXP]);

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
    // IMPORTANT: NE PAS réinitialiser currentStreak et longestStreak
    // Les streaks de partie persistent entre les sessions pour encourager le jeu continu
    // Seul le bouclier est réinitialisé (garder le permanent s'il existe)
    setNewlyUnlocked([]);
    setInGameShields(hasPermanentShield ? 1 : 0);
    // Réinitialiser les états XP
    setRecentXPGain(0);
    setInitialSessionXP(profile?.xp || 0);
    setLevelUpNotification(null);
    clearAchievementsTimer();
  }, [clearAchievementsTimer, hasPermanentShield, profile?.xp]);

  /**
   * Supprime la session active de IndexedDB.
   * Appelée uniquement quand la partie est terminée (victoire/défaite) ou abandonnée.
   */
  const clearSessionFromDB = useCallback(async () => {
    try {
      await active_session.delete(1);
      console.log('[GameContext] Active session cleared from DB');
    } catch (err) {
      console.error('[GameContext] Failed to clear active session:', err);
    }
  }, []);

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
        // Nettoyer la session sauvegardée de Dexie
        await clearSessionFromDB();
      }
      setDailySeed(null);
      setDailySeedSession(null);
    },
    [abortActiveFetch, abortPrefetchFetch, resetSessionState, clearSessionFromDB]
  );

  const clearError = useCallback(() => setError(null), []);

  /**
   * Sérialise et sauvegarde l'état actuel du jeu vers IndexedDB (active_session).
   * Appelée automatiquement avant unmount ou beforeunload.
   */
  const pauseGame = useCallback(async () => {
    if (!isGameActive) return;

      const sessionData = {
      id: 1, // Clé unique
      currentQuestionIndex: questionCount,
      currentQuestion: question, // Sauvegarder la question complète pour la reprendre sans recharger du serveur
      score,
      sessionStats,
      sessionCorrectSpecies,
      sessionSpeciesData,
      sessionMissedSpecies,
      currentStreak,
      longestStreak,
      inGameShields,
      hasPermanentShield,
      // FIX #8: Save timer and prefetched question to maintain accurate timing
      questionStartTime: questionStartTimeRef.current,
      nextQuestion: nextQuestion,
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
      console.log('[GameContext] Session paused and saved', sessionData);
    } catch (err) {
      console.error('[GameContext] Failed to pause game session:', err);
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
  ]);

  /**
   * Restaure l'état du jeu depuis IndexedDB (active_session).
   * Retourne les données de session ou null si aucune session n'existe.
   */
  const resumeGame = useCallback(async () => {
    try {
      console.log('[GameContext] resumeGame() - Starting restoration');
      const sessionData = await active_session.get(1);
      if (!sessionData) {
        console.log('[GameContext] No active session found');
        return null;
      }

      console.log('[GameContext] Session resumed from DB, data:', {
        currentQuestionIndex: sessionData.currentQuestionIndex,
        score: sessionData.score,
        gameConfig: sessionData.gameConfig,
      });

      // Restaurer l'état depuis les données sauvegardées
      const config = sessionData.gameConfig || {};
      console.log('[GameContext] Restoring config:', config);
      
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
      
      // FIX #8: Restore timer and prefetched question
      if (typeof sessionData.questionStartTime === 'number') {
        questionStartTimeRef.current = sessionData.questionStartTime;
      }

      console.log('[GameContext] About to set isGameActive to true');
      setIsGameActive(true);
      setIsGameOver(false);
      // Restaurer la question sauvegardée si elle existe
      setQuestion(sessionData.currentQuestion || null);
      // Restore prefetched next question to avoid latency
      setNextQuestion(sessionData.nextQuestion || null);

      console.log('[GameContext] resumeGame() - Restoration complete');
      return sessionData;
    } catch (err) {
      console.error('[GameContext] Failed to resume game session:', err);
      return null;
    }
  }, []);

  /**
   * Automatiquement pause le jeu au démontage du composant (unmount).
   * Cette fonction ne s'exécute qu'une fois lors du cleanup du GameProvider.
   */
  useEffect(() => {
    return () => {
      // Le jeu est actif et on quitte le composant
      if (isGameActive) {
        pauseGame().catch((err) => console.error('[GameContext] Error pausing game on unmount:', err));
      }
    };
  }, [isGameActive, pauseGame]);

  /**
   * Sauvegarder la session avant un rechargement de page (beforeunload).
   */
  useEffect(() => {
    const handleBeforeUnload = async (e) => {
      if (isGameActive) {
        await pauseGame();
        // Certains navigateurs demandent une confirmation
        e.preventDefault();
        e.returnValue = '';
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', handleBeforeUnload);
      return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }
  }, [isGameActive, pauseGame]);

  /**
   * Sauvegarder la session quand l'onglet devient invisible (visibilitychange).
   * Utile pour les mobiles et les changements d'onglet.
   */
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.hidden && isGameActive) {
        await pauseGame();
        console.log('[GameContext] Session paused due to visibility change');
      }
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
      return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }
  }, [isGameActive, pauseGame]);

  const updateScore = useCallback((delta) => {
    setScore((prev) => prev + delta);
  }, []);

  const buildQuizParams = useCallback(() => {
    const params = new URLSearchParams();
    const isDailyChallenge = typeof dailySeed === 'string' && dailySeed.length > 0;
    const effectiveMediaType = isDailyChallenge ? DEFAULT_MEDIA_TYPE : mediaType;
    const effectiveGameMode = normalizeGameMode(gameMode, 'easy');
    const resolvedMediaType = effectiveGameMode === 'riddle' ? DEFAULT_MEDIA_TYPE : effectiveMediaType;
    params.set('locale', language);
    params.set('media_type', resolvedMediaType);
    params.set('game_mode', effectiveGameMode);
    if (isDailyChallenge) {
      params.set('seed', dailySeed);
      if (dailySeedSession) params.set('seed_session', dailySeedSession);
      return params;
    }

    if (isReviewMode) {
      const reviewIds =
        reviewTaxonIds.length > 0 ? reviewTaxonIds : profile?.stats?.missedSpecies || [];
      if (reviewIds.length > 0) {
        params.set('taxon_ids', reviewIds.join(','));
      }
      return params;
    }

    if (activePack?.type === 'list') {
      params.set('pack_id', activePack.id);
    } else if (activePack?.type === 'dynamic') {
      params.set('pack_id', activePack.id);
    } else {
      if (customFilters.taxa_enabled) {
        customFilters.includedTaxa.forEach((taxon) => params.append('include_taxa', taxon.id));
        customFilters.excludedTaxa.forEach((taxon) => params.append('exclude_taxa', taxon.id));
      }

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

      if (customFilters.period_enabled) {
        if (customFilters.d1) params.set('d1', customFilters.d1);
        if (customFilters.d2) params.set('d2', customFilters.d2);
      }
    }
    return params;
  }, [
    activePack,
    customFilters,
    isReviewMode,
    reviewTaxonIds,
    language,
    mediaType,
    gameMode,
    dailySeed,
    dailySeedSession,
    profile?.stats?.missedSpecies,
  ]);

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
          if (gameMode !== 'riddle') {
            // Précharger les images de la prochaine question en arrière-plan
            preloadQuestionImages(questionData).catch(() => {
              // Les erreurs de préchargement sont silencieuses
            });
          }
          setNextQuestion(questionData);
        } else {
          if (gameMode !== 'riddle') {
            // Précharger les images de la question courante
            preloadQuestionImages(questionData).catch(() => {
              // Les erreurs de préchargement sont silencieuses
            });
          }
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
    [abortActiveFetch, abortPrefetchFetch, buildQuizParams, gameMode, t]
  );

  useEffect(() => {
    if (isGameActive && !question && questionCount > 0 && !loading) {
      fetchQuestion();
    }
  }, [fetchQuestion, isGameActive, loading, question, questionCount]);

  useEffect(() => {
    if (question?.bonne_reponse?.id) {
      const now =
        typeof performance !== 'undefined' && typeof performance.now === 'function'
          ? performance.now()
          : Date.now();
      questionStartTimeRef.current = now;
    }
  }, [question?.bonne_reponse?.id]);

  useEffect(() => {
    if (isStartingNewGame && (question || error)) {
      setIsStartingNewGame(false);
    }
  }, [isStartingNewGame, question, error]);

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
      // Nettoyer l'ancienne session sauvegardée de Dexie si elle existe
      clearSessionFromDB().catch((err) => console.error('[GameContext] Error clearing session at game start:', err));
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
      setGameMode((prev) =>
        forcedGameMode === undefined ? prev : normalizeGameMode(forcedGameMode, prev)
      );
      setMaxQuestions((prev) =>
        forcedMaxQuestions === undefined ? prev : normalizeMaxQuestions(forcedMaxQuestions, prev)
      );
      setMediaType((prev) =>
        nextMediaType === undefined ? prev : normalizeMediaType(nextMediaType, prev)
      );
    },
    [abortActiveFetch, abortPrefetchFetch, resetSessionState, clearSessionFromDB, profile]
  );

  /**
   * Start review mode (Spaced Repetition).
   * Fetches species due for review and starts a custom game session.
   */
  const startReviewMode = useCallback(async () => {
    try {
      const speciesToReview = await getSpeciesDueForReview(50);
      const taxonIds = speciesToReview
        .map(({ taxon }) => taxon?.id)
        .filter((id) => Number.isFinite(id));
      
      if (taxonIds.length === 0) {
        notify('Aucune espèce à réviser aujourd\'hui ! 🎉', { 
          type: 'success',
          duration: 3000 
        });
        return false;
      }
      
      // Store review taxon IDs for API targeting
      setReviewTaxonIds(taxonIds);

      // Start the game with review mode enabled
      startGame({ review: true, gameMode: 'easy', maxQuestions: taxonIds.length });
      
      notify(`📚 ${taxonIds.length} espèce${taxonIds.length > 1 ? 's' : ''} à réviser`, {
        type: 'info',
        duration: 3000
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
  }, [startGame]);

  const nextImageUrl = useMemo(() => {
    if (mediaType === 'sounds') return null;
    if (!nextQuestion) return null;
    return nextQuestion.image_urls?.[0] || nextQuestion.image_url || null;
  }, [mediaType, nextQuestion]);

  // Preload next image for better performance
  useEffect(() => {
    if (nextImageUrl) {
      const img = new Image();
      img.src = nextImageUrl;
    }
  }, [nextImageUrl]);

  // Perks system removed - multiplier is now always 1.0
  const currentMultiplier = 1.0;

  // `clearUnlockedLater` is provided by Achievement context

  const finalizeGame = useCallback(
    ({
      finalCorrectAnswers,
      finalScore,
      finalCorrectSpecies,
      finalMissedSpecies,
      speciesEntries = [],
    }) => {
      const profileClone = profile
        ? JSON.parse(JSON.stringify(profile))
        : loadProfileWithDefaults();
      const totalQuestions = Array.isArray(speciesEntries)
        ? speciesEntries.length
        : resolveTotalQuestions(maxQuestions, questionCount);

      // XP already applied in completeRound - just update game stats
      profileClone.stats.gamesPlayed = (profileClone.stats.gamesPlayed || 0) + 1;

      if (gameMode === 'easy') {
        profileClone.stats.correctEasy = (profileClone.stats.correctEasy || 0) + finalCorrectAnswers;
        profileClone.stats.easyQuestionsAnswered =
          (profileClone.stats.easyQuestionsAnswered || 0) + totalQuestions;
        profileClone.stats.accuracyEasy = profileClone.stats.easyQuestionsAnswered > 0
          ? profileClone.stats.correctEasy / profileClone.stats.easyQuestionsAnswered
          : 0;
      } else if (gameMode === 'riddle') {
        profileClone.stats.correctRiddle = (profileClone.stats.correctRiddle || 0) + finalCorrectAnswers;
        profileClone.stats.riddleQuestionsAnswered =
          (profileClone.stats.riddleQuestionsAnswered || 0) + totalQuestions;
        profileClone.stats.accuracyRiddle = profileClone.stats.riddleQuestionsAnswered > 0
          ? profileClone.stats.correctRiddle / profileClone.stats.riddleQuestionsAnswered
          : 0;
      } else {
        profileClone.stats.correctHard = (profileClone.stats.correctHard || 0) + finalCorrectAnswers;
        profileClone.stats.hardQuestionsAnswered =
          (profileClone.stats.hardQuestionsAnswered || 0) + totalQuestions;
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

      const unlocked = checkNewAchievements(profileClone);
      
      // Vérifier aussi les succès de fin de partie
      const endOfGameUnlocked = checkEndOfGameAchievements({
        sessionXP: finalScore,
        gameHour: new Date().getHours(),
        totalQuestions,
        correctAnswers: finalCorrectAnswers,
        hintsUsed: speciesEntries.filter(e => e.hintsUsed).length,
        shieldsUsed: speciesEntries.filter(e => !e.wasCorrect).length, // Approximation
        gameMode,
        gameWon: finalCorrectAnswers > 0,
      }, profileClone.achievements);
      
      // Fusionner tous les succès débloqués
      const allUnlocked = [...new Set([...unlocked, ...endOfGameUnlocked])];
      
      if (allUnlocked.length > 0) {
        // Ajouter les succès au profil
        profileClone.achievements = Array.from(
          new Set([...(profileClone.achievements || []), ...allUnlocked])
        );
        
        // Appliquer les récompenses (XP, titres, bordures, multiplicateurs)
        const rewardResult = applyAllRewards(profileClone, allUnlocked);
        Object.assign(profileClone, rewardResult.profile);
        
        // Notifier des récompenses obtenues
        if (rewardResult.totalXP > 0) {
          notify(`🎉 +${rewardResult.totalXP} XP bonus!`, { type: 'success', duration: 4000 });
        }
        if (rewardResult.titlesUnlocked.length > 0) {
          notify(`🏷️ Nouveau titre débloqué!`, { type: 'success', duration: 4000 });
        }
        if (rewardResult.bordersUnlocked.length > 0) {
          notify(`🖼️ Nouvelle bordure débloquée!`, { type: 'success', duration: 4000 });
        }
        
        // Notifier le système d'achievements
        queueAchievements(allUnlocked);
        setNewlyUnlocked(allUnlocked);
        clearUnlockedLater();
      } else {
        setNewlyUnlocked([]);
        clearAchievementsTimer();
      }

      // Update daily streak after completing a game
      const profileWithStreakUpdate = updateDailyStreak(profileClone);
      
      // Mettre à jour les stats de weekend warrior
      const profileWithWeekendStats = {
        ...profileWithStreakUpdate,
        stats: updateWeekendStats(profileWithStreakUpdate.stats, new Date()),
      };
      
      // Save in-game streak records to profile for achievements tracking
      // NOTE: These are session-based combo stats, NOT daily streak
      // - currentStreak: The final combo streak achieved this session
      // - longestStreak: All-time best combo streak record
      profileWithWeekendStats.stats.lastSessionStreak = currentStreak;
      if (longestStreak > (profileWithWeekendStats.stats.longestStreak || 0)) {
        profileWithWeekendStats.stats.longestStreak = longestStreak;
      }

      // FIX #7: Clear session BEFORE changing game state to prevent restoration of finished game
      // This ensures if clearSessionFromDB fails, the session won't be restored as a finished game
      clearSessionFromDB()
        .then(() => {
          // Only after successful cleanup, update game state
          updateProfile(profileWithWeekendStats);
          setIsGameActive(false);
          setIsGameOver(true);
          setNextQuestion(null);
        })
        .catch((err) => {
          console.error('[GameContext] Error clearing session after game end:', err);
          // Even if cleanup fails, update state to avoid stuck game
          updateProfile(profileWithStreakUpdate);
          setIsGameActive(false);
          setIsGameOver(true);
          setNextQuestion(null);
        });
    },
    [
      activePackId,
      clearAchievementsTimer,
      clearUnlockedLater,
      clearSessionFromDB,
      currentStreak,
      gameMode,
      longestStreak,
      maxQuestions,
      profile,
      questionCount,
      queueAchievements,
      updateProfile,
    ]
  );

  const completeRound = useCallback(
    ({ points = 0, bonus = 0, streakBonus = 0, isCorrect = null, roundMeta = {} } = {}) => {
      if (!question) return;

      const currentQuestionId = question.bonne_reponse.id;
      const isCorrectFinal = typeof isCorrect === 'boolean' ? isCorrect : points > 0;
      
      // NEW: Handle shields on incorrect answer
      let newStreak = currentStreak;
      if (!isCorrectFinal) {
        // Check if a shield is available
        if (inGameShields > 0) {
          // Use the shield to preserve streak
          setInGameShields((prev) => prev - 1);
          // Streak is preserved, no change to newStreak
        } else {
          // No shield - reset streak
          const finalStreak = currentStreak;
          
          // Track longest streak
          if (finalStreak > longestStreak) {
            setLongestStreak(finalStreak);
          }
          
          newStreak = 0;
        }
      } else {
        // Correct answer - increment streak
        newStreak = currentStreak + 1;
        
        // Track longest streak
        if (newStreak > longestStreak) {
          setLongestStreak(newStreak);
        }
        
        // Earn a shield every 5 streaks (max 3)
        if (newStreak % 5 === 0 && inGameShields < 3) {
          setInGameShields((prev) => Math.min(prev + 1, 3));
        }
      }
      
      setCurrentStreak(newStreak);

      // Perks system removed - no multiplier on score bonus
      const baseBonus = (bonus || 0) + (streakBonus || 0);
      const adjustedBonus = baseBonus;
      const updatedScore = score + points + adjustedBonus;
      setScore(updatedScore);

      // Calcul XP avec multiplicateurs (utiliser newStreak qui est la streak APRÈS ce round)
      // Pas d'XP si la réponse est incorrecte
      let baseXP = isCorrectFinal ? (points + adjustedBonus) : 0;
      
      // Bonus révision : +25% XP
      if (isReviewMode && baseXP > 0) {
        const reviewBonus = Math.floor(baseXP * 0.25);
        baseXP += reviewBonus;
        
        // Notification si première question de la session de révision
        if (questionCount === 1) {
          notify('📚 Mode Révision : +25% XP', { 
            type: 'info',
            duration: 3000 
          });
        }
      }
      
      // No perks multiplier - pass 1.0 as base multiplier
      const xpMultipliers = calculateXPMultipliers(profile, isCorrectFinal ? newStreak : 0);
      const earnedXP = Math.floor(baseXP * xpMultipliers.totalMultiplier);
      
      // Mettre à jour le profil avec le nouvel XP
      if (earnedXP > 0) {
        // Afficher le popup de gain XP
        setRecentXPGain(earnedXP);
        
        // Réinitialiser après l'animation (2 secondes)
        setTimeout(() => {
          setRecentXPGain(0);
        }, 2000);
        
        // FIX #1: Use functional update to prevent race conditions on double-tap
        // Calculate oldXP, newXP, and level changes INSIDE the update function
        updateProfile((prev) => {
          const base = prev ?? loadProfileWithDefaults();
          const oldXP = base.xp || 0;
          const newXP = oldXP + earnedXP;
          const oldLevel = getLevelFromXp(oldXP);
          const newLevel = getLevelFromXp(newXP);
          
          // Détecter le level up
          if (newLevel > oldLevel) {
            setLevelUpNotification({
              oldLevel,
              newLevel,
              timestamp: Date.now(),
            });
            
            // Cacher la notification après 4 secondes
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

      const microUnlocks = evaluateMicroChallenges(
        {
          currentStreak: newStreak,
          roundMeta: roundDetails,
          sessionSpeciesData: nextSpeciesData,
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

      // Perks system removed - no perks state management needed

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
      currentStreak,
      inGameShields,
      longestStreak,
      fetchQuestion,
      finalizeGame,
      gameMode,
      nextQuestion,
      profile,
      question,
      questionCount,
      queueAchievements,
      score,
      sessionCorrectSpecies,
      sessionMissedSpecies,
      sessionSpeciesData,
      sessionStats.correctAnswers,
      maxQuestions,
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
  ]);

  const canStartReview = (profile?.stats?.missedSpecies?.length || 0) >= DEFAULT_MAX_QUESTIONS;

  const dataValue = useMemo(
    () => ({
      activePackId,
      setActivePackId,
      customFilters,
      dispatchCustomFilters,
      gameMode,
      setGameMode,
      isGameActive,
      isStartingNewGame,
      isGameOver,
      question,
      nextQuestion,
      questionCount,
      maxQuestions,
      setMaxQuestions,
      mediaType,
      setMediaType,
      dailySeed,
      dailySeedSession,
      score,
      sessionStats,
      sessionCorrectSpecies,
      sessionSpeciesData,
      sessionMissedSpecies,
      isReviewMode,
      reviewTaxonIds,
      currentStreak,
      longestStreak,
      inGameShields,
      hasPermanentShield,
      currentMultiplier,
      newlyUnlocked,
      nextImageUrl,
      // États XP
      recentXPGain,
      initialSessionXP,
      levelUpNotification,
      xpMultipliers: calculateXPMultipliers(profile, currentStreak),
      updateScore,
      completeRound,
      endGame,
      startGame,
      startReviewMode,
      resetToLobby,
      canStartReview,
      pauseGame,
      resumeGame,
      clearSessionFromDB,
    }),
    [
      activePackId,
      customFilters,
      gameMode,
      isGameActive,
      isStartingNewGame,
      isGameOver,
      question,
      nextQuestion,
      questionCount,
      maxQuestions,
      mediaType,
      dailySeed,
      dailySeedSession,
      score,
      sessionStats,
      sessionCorrectSpecies,
      sessionSpeciesData,
      sessionMissedSpecies,
      isReviewMode,
      reviewTaxonIds,
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
      profile,
      updateScore,
      completeRound,
      endGame,
      startGame,
      startReviewMode,
      resetToLobby,
      canStartReview,
      pauseGame,
      resumeGame,
      clearSessionFromDB,
    ]
  );

  const uiValue = useMemo(
    () => ({
      loading,
      error,
      clearError,
    }),
    [loading, error, clearError]
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
