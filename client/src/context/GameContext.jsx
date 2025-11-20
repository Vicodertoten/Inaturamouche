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
import { useUser } from './UserContext';
import { useLanguage } from './LanguageContext.jsx';
import { usePacks } from './PacksContext.jsx';

export const MAX_QUESTIONS_PER_GAME = 5;

const STREAK_PERKS = [
  {
    tier: 1,
    threshold: 3,
    rewards: [
      {
        type: 'lifeline',
        amount: 1,
        persistOnMiss: true,
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

const mintPerkRewards = (config) => {
  if (!config?.rewards) return [];
  const minted = [];
  config.rewards.forEach((reward, rewardIndex) => {
    if (reward.type === 'lifeline') {
      const amount = reward.amount || 1;
      for (let i = 0; i < amount; i += 1) {
        minted.push({
          id: generatePerkId(`lifeline-${config.tier}-${rewardIndex}-${i}`),
          type: 'lifeline',
          persistOnMiss: reward.persistOnMiss ?? true,
          label: reward.label || 'free_hint',
        });
      }
    } else if (reward.type === 'multiplier') {
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

const GameContext = createContext(null);

export function GameProvider({ children }) {
  const { profile, updateProfile, queueAchievements } = useUser();
  const { language, t } = useLanguage();
  const { packs, loading: packsLoading } = usePacks();

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
  const [streakTier, setStreakTier] = useState(0);
  const [activePerks, setActivePerks] = useState([]);
  const [isReviewMode, setIsReviewMode] = useState(false);
  const [newlyUnlocked, setNewlyUnlocked] = useState([]);
  const activePack = useMemo(
    () => packs.find((pack) => pack.id === activePackId),
    [packs, activePackId]
  );

  useEffect(() => {
    if (!packsLoading && activePackId !== 'custom' && !activePack) {
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
    setCurrentStreak(0);
    setStreakTier(0);
    setActivePerks([]);
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
  }, [activePack, activePackId, customFilters, isReviewMode, language, profile?.stats?.missedSpecies]);

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

  const availableLifelines = useMemo(
    () => activePerks.filter((perk) => perk.type === 'lifeline').length,
    [activePerks]
  );

  const currentMultiplier = useMemo(
    () => computeMultiplierFromPerks(activePerks),
    [activePerks]
  );

  const useLifeline = useCallback(() => {
    let consumed = false;
    setActivePerks((prev) => {
      const index = prev.findIndex((perk) => perk.type === 'lifeline');
      if (index === -1) return prev;
      consumed = true;
      const next = [...prev];
      next.splice(index, 1);
      return next;
    });
    return consumed;
  }, []);

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

      updateProfile(profileClone);
      setIsGameActive(false);
      setIsGameOver(true);
      setNextQuestion(null);
    },
    [activePackId, clearAchievementsTimer, clearUnlockedLater, gameMode, profile, queueAchievements, updateProfile]
  );

  const completeRound = useCallback(
    ({ points = 0, bonus = 0, streakBonus = 0, isCorrect = null, roundMeta = {} } = {}) => {
      if (!question) return;

      const currentQuestionId = question.bonne_reponse.id;
      const isCorrectFinal = typeof isCorrect === 'boolean' ? isCorrect : points > 0;
      const newStreak = isCorrectFinal ? currentStreak + 1 : 0;
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
        bonus: adjustedBonus,
        streak: newStreak,
        biomes: derivedBiomes,
        hintsUsed: !!roundDetails.hintsUsed,
        hintCount: roundDetails.hintCount || 0,
        responseTimeMs,
        genusId: genusEntry?.id || null,
        genusName: genusEntry?.name || null,
        wasCorrect: isCorrectFinal,
        lifelineUsed: !!roundDetails.lifelineUsed,
        perksUsed: roundDetails.perksUsed || [],
        multiplierApplied: multiplier,
      };
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
          speciesEntries: nextSpeciesData,
        });
      }
    },
    [
      activePerks,
      activePack,
      currentStreak,
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
      updateProfile,
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
    streakTier,
    activePerks,
    availableLifelines,
    currentMultiplier,
    newlyUnlocked,
    nextImageUrl,
    updateScore,
    completeRound,
    startGame,
    resetToLobby,
    useLifeline,
    canStartReview,
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame() {
  const context = useContext(GameContext);
  if (!context) throw new Error('useGame must be used within a GameProvider');
  return context;
}
