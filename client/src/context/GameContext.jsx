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
import { checkNewAchievements, evaluateMicroChallenges } from '../achievements';
import { initialCustomFilters, customFilterReducer } from '../state/filterReducer';
import { fetchQuizQuestion } from '../services/api';
import { loadProfileWithDefaults } from '../services/PlayerProfile';
import { updateDailyStreak, applyXPWithStreakBonus } from '../services/StreakService';
import { active_session } from '../services/db';
import { useUser } from './UserContext';
import { useLanguage } from './LanguageContext.jsx';
import { usePacks } from './PacksContext.jsx';

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
  if (value === 'easy' || value === 'hard') return value;
  return fallback;
};

const hasQuestionLimit = (value) => Number.isInteger(value) && value > 0;

const resolveTotalQuestions = (maxQuestions, questionCount) =>
  hasQuestionLimit(maxQuestions) ? maxQuestions : questionCount || 0;

const STREAK_PERKS = [
  {
    tier: 1,
    threshold: 3,
    rewards: [
      {
        type: 'multiplier',
        value: 1.2,
        rounds: 2,
        persistOnMiss: false,
      },
    ],
  },
  {
    tier: 2,
    threshold: 5,
    rewards: [
      {
        type: 'multiplier',
        value: 1.5,
        rounds: 3,
        persistOnMiss: false,
      },
    ],
  },
];

const generatePerkId = (prefix) =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

const createSeedSessionId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const mintPerkRewards = (config) => {
  if (!config?.rewards) return [];
  const minted = [];
  config.rewards.forEach((reward, rewardIndex) => {
    if (reward.type === 'multiplier') {
      minted.push({
        id: generatePerkId(`multiplier-${config.tier}-${rewardIndex}`),
        type: 'multiplier',
        persistOnMiss: reward.persistOnMiss ?? false,
        value: reward.value || 1.2,
        roundsRemaining: reward.rounds || 2,
      });
    }
  });
  return minted;
};

const computeMultiplierFromPerks = (perks = []) =>
  perks
    .filter((perk) => perk.type === 'multiplier' && (perk.roundsRemaining ?? 0) > 0)
    .reduce((acc, perk) => acc * (perk.value || 1), 1);

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
  const [currentStreak, setCurrentStreak] = useState(profile?.stats?.currentStreak || 0);
  const [longestStreak, setLongestStreak] = useState(profile?.stats?.longestStreak || 0);
  const [inGameShields, setInGameShields] = useState(0);
  const [hasPermanentShield, setHasPermanentShield] = useState(
    profile?.achievements?.includes('STREAK_GUARDIAN') || false
  );
  const [streakTier, setStreakTier] = useState(0);
  const [activePerks, setActivePerks] = useState([]);
  const [isReviewMode, setIsReviewMode] = useState(false);
  const [newlyUnlocked, setNewlyUnlocked] = useState([]);
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

  const achievementsTimerRef = useRef(null);
  const activeRequestController = useRef(null);
  const prefetchRequestController = useRef(null);
  const questionStartTimeRef = useRef(null);

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
    // NE PAS RESET la streak actuelle - elle persiste entre les parties
    setStreakTier(0);
    setActivePerks([]);
    setNewlyUnlocked([]);
    // Réinitialiser les boucliers de partie (garder le permanent s'il existe)
    setInGameShields(hasPermanentShield ? 1 : 0);
    clearAchievementsTimer();
  }, [clearAchievementsTimer, hasPermanentShield]);

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
      streakTier,
      activePerks,
      gameConfig: {
        activePackId,
        customFilters,
        gameMode,
        maxQuestions,
        mediaType,
        dailySeed,
        dailySeedSession,
        isReviewMode,
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
    score,
    sessionStats,
    sessionCorrectSpecies,
    sessionSpeciesData,
    sessionMissedSpecies,
    currentStreak,
    longestStreak,
    inGameShields,
    hasPermanentShield,
    streakTier,
    activePerks,
    activePackId,
    customFilters,
    gameMode,
    maxQuestions,
    mediaType,
    dailySeed,
    dailySeedSession,
    isReviewMode,
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
      setGameMode(config.gameMode || 'easy');
      setMaxQuestions(config.maxQuestions ?? DEFAULT_MAX_QUESTIONS);
      setMediaType(config.mediaType || DEFAULT_MEDIA_TYPE);
      setDailySeed(config.dailySeed || null);
      setDailySeedSession(config.dailySeedSession || null);
      setIsReviewMode(config.isReviewMode || false);

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
      setStreakTier(sessionData.streakTier || 0);
      setActivePerks(sessionData.activePerks || []);

      console.log('[GameContext] About to set isGameActive to true');
      setIsGameActive(true);
      setIsGameOver(false);
      // Restaurer la question sauvegardée si elle existe
      setQuestion(sessionData.currentQuestion || null);
      setNextQuestion(null);

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

  const updateScore = useCallback((delta) => {
    setScore((prev) => prev + delta);
  }, []);

  const buildQuizParams = useCallback(() => {
    const params = new URLSearchParams();
    const isDailyChallenge = typeof dailySeed === 'string' && dailySeed.length > 0;
    const effectiveMediaType = isDailyChallenge ? DEFAULT_MEDIA_TYPE : mediaType;
    params.set('locale', language);
    params.set('media_type', effectiveMediaType);
    if (isDailyChallenge) {
      params.set('seed', dailySeed);
      if (dailySeedSession) params.set('seed_session', dailySeedSession);
      return params;
    }

    if (isReviewMode) {
      (profile?.stats?.missedSpecies || []).forEach((id) => params.append('taxon_ids', id));
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
    language,
    mediaType,
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
    [abortActiveFetch, abortPrefetchFetch, resetSessionState, clearSessionFromDB]
  );

  const nextImageUrl = useMemo(() => {
    if (mediaType === 'sounds') return null;
    if (!nextQuestion) return null;
    return nextQuestion.image_urls?.[0] || nextQuestion.image_url || null;
  }, [mediaType, nextQuestion]);

  const currentMultiplier = useMemo(
    () => computeMultiplierFromPerks(activePerks),
    [activePerks]
  );

  const clearUnlockedLater = useCallback(() => {
    clearAchievementsTimer();
    achievementsTimerRef.current = setTimeout(() => setNewlyUnlocked([]), 5000);
  }, [clearAchievementsTimer]);

  const evaluatePerksForStreak = useCallback(
    (streakValue) => {
      let tierReached = streakTier;
      const minted = [];
      STREAK_PERKS.forEach((config) => {
        if (streakValue >= config.threshold && config.tier > tierReached) {
          minted.push(...mintPerkRewards(config));
          tierReached = config.tier;
        }
      });
      return { tierReached, minted };
    },
    [streakTier]
  );

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

      // Apply XP with streak bonus
      const finalScoreWithBonus = applyXPWithStreakBonus(finalScore, profileClone);
      profileClone.xp = (profileClone.xp || 0) + finalScoreWithBonus;
      profileClone.stats.gamesPlayed = (profileClone.stats.gamesPlayed || 0) + 1;

      if (gameMode === 'easy') {
        profileClone.stats.correctEasy = (profileClone.stats.correctEasy || 0) + finalCorrectAnswers;
        profileClone.stats.easyQuestionsAnswered =
          (profileClone.stats.easyQuestionsAnswered || 0) + totalQuestions;
        profileClone.stats.accuracyEasy = profileClone.stats.easyQuestionsAnswered > 0
          ? profileClone.stats.correctEasy / profileClone.stats.easyQuestionsAnswered
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

      // Update daily streak after completing a game
      const profileWithStreakUpdate = updateDailyStreak(profileClone);
      
      // Save in-game streak stats to profile
      profileWithStreakUpdate.stats.currentStreak = currentStreak;
      profileWithStreakUpdate.stats.longestStreak = longestStreak;

      updateProfile(profileWithStreakUpdate);
      setIsGameActive(false);
      setIsGameOver(true);
      setNextQuestion(null);
      // Effacer la session sauvegardée puisque la partie est terminée
      clearSessionFromDB().catch((err) => console.error('[GameContext] Error clearing session after game end:', err));
    },
    [
      activePackId,
      clearAchievementsTimer,
      clearUnlockedLater,
      clearSessionFromDB,
      gameMode,
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

      const multiplier = computeMultiplierFromPerks(activePerks);
      const baseBonus = (bonus || 0) + (streakBonus || 0);
      const adjustedBonus = Math.round(baseBonus * multiplier);
      const updatedScore = score + points + adjustedBonus;
      setScore(updatedScore);

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
        multiplierApplied: multiplier,
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

      let nextPerksState = activePerks.map((perk) => {
        if (perk.type !== 'multiplier') return perk;
        return {
          ...perk,
          roundsRemaining: Math.max(0, (perk.roundsRemaining ?? 1) - 1),
        };
      });
      nextPerksState = nextPerksState.filter(
        (perk) => perk.type !== 'multiplier' || (perk.roundsRemaining ?? 0) > 0
      );

      if (!isCorrectFinal) {
        setStreakTier(0);
        nextPerksState = nextPerksState.filter((perk) => perk.persistOnMiss !== false);
      } else {
        const { tierReached, minted } = evaluatePerksForStreak(newStreak);
        if (tierReached !== streakTier) {
          setStreakTier(tierReached);
        }
        if (minted.length) {
          nextPerksState = [...nextPerksState, ...minted];
        }
      }
      setActivePerks(nextPerksState);

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
      activePerks,
      activePack,
      addSpeciesToCollection,
      currentStreak,
      inGameShields,
      longestStreak,
      evaluatePerksForStreak,
      fetchQuestion,
      finalizeGame,
      gameMode,
      nextQuestion,
      profile?.achievements,
      question,
      questionCount,
      queueAchievements,
      score,
      sessionCorrectSpecies,
      sessionMissedSpecies,
      sessionSpeciesData,
      sessionStats.correctAnswers,
      streakTier,
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
      currentStreak,
      longestStreak,
      inGameShields,
      hasPermanentShield,
      streakTier,
      activePerks,
      currentMultiplier,
      newlyUnlocked,
      nextImageUrl,
      updateScore,
      completeRound,
      endGame,
      startGame,
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
      currentStreak,
      longestStreak,
      inGameShields,
      hasPermanentShield,
      streakTier,
      activePerks,
      currentMultiplier,
      newlyUnlocked,
      nextImageUrl,
      updateScore,
      completeRound,
      endGame,
      startGame,
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
