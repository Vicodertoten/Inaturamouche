import { useCallback, useEffect, useRef } from 'react';
import { fetchQuizQuestion } from '../../services/api';
import { trackMetric } from '../../services/metrics';
import { preloadQuestionImages } from '../../utils/imagePreload';
import { normalizeGameMode } from './gameUtils';

export function useGameRequests({
  activePack,
  customFilters,
  isReviewMode,
  reviewTaxonIds,
  language,
  mediaType,
  gameMode,
  dailySeed,
  dailySeedSession,
  profileMissedSpecies,
  t,
  isGameActive,
  question,
  questionCount,
  loading,
  setLoading,
  setError,
  setIsGameActive,
  setIsGameOver,
  setQuestionCount,
  setQuestion,
  setNextQuestion,
}) {
  const activeRequestController = useRef(null);
  const prefetchRequestController = useRef(null);
  const questionStartTimeRef = useRef(null);
  const seedQuestionCursorRef = useRef(null);
  const lastViewedRoundIdRef = useRef(null);

  useEffect(() => {
    return () => {
      activeRequestController.current?.abort();
      prefetchRequestController.current?.abort();
    };
  }, []);

  useEffect(() => {
    seedQuestionCursorRef.current = null;
  }, [dailySeed, dailySeedSession]);

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

  const buildQuizParams = useCallback((seedQuestionIndexOverride = null) => {
    const params = new URLSearchParams();
    const hasSeed = typeof dailySeed === 'string' && dailySeed.length > 0;
    const effectiveGameMode = hasSeed ? 'easy' : normalizeGameMode(gameMode, 'easy');
    params.set('locale', language);
    params.set('media_type', mediaType);
    params.set('game_mode', effectiveGameMode);
    if (hasSeed) {
      params.set('seed', dailySeed);
      if (dailySeedSession) params.set('seed_session', dailySeedSession);
      const normalizedIndex = Number.isInteger(seedQuestionIndexOverride)
        ? Math.max(0, seedQuestionIndexOverride)
        : Math.max(0, questionCount - 1);
      params.set('question_index', String(normalizedIndex));
      return params;
    }

    if (isReviewMode) {
      const reviewIds = reviewTaxonIds.length > 0 ? reviewTaxonIds : profileMissedSpecies || [];
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
        const normalizePeriodDate = (value) => {
          if (!value) return '';
          const parts = value.split('-');
          if (parts.length < 3) return '';
          const month = parts[1]?.padStart(2, '0');
          const day = parts[2]?.padStart(2, '0');
          if (!month || !day) return '';
          return `2000-${month}-${day}`;
        };
        const normalizedStart = normalizePeriodDate(customFilters.d1);
        const normalizedEnd = normalizePeriodDate(customFilters.d2);
        if (normalizedStart) params.set('d1', normalizedStart);
        if (normalizedEnd) params.set('d2', normalizedEnd);
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
    profileMissedSpecies,
    questionCount,
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
        const hasSeed = typeof dailySeed === 'string' && dailySeed.length > 0;
        let seedQuestionIndex = null;
        if (hasSeed) {
          if (prefetchOnly) {
            seedQuestionIndex = Number.isInteger(seedQuestionCursorRef.current)
              ? seedQuestionCursorRef.current + 1
              : Math.max(0, questionCount);
          } else {
            seedQuestionIndex = Math.max(0, questionCount - 1);
          }
        }
        const params = buildQuizParams(seedQuestionIndex);
        const questionData = await fetchQuizQuestion(params, { signal: controller.signal });
        if (hasSeed && Number.isInteger(seedQuestionIndex)) {
          seedQuestionCursorRef.current = seedQuestionIndex;
        }

        if (prefetchOnly) {
          preloadQuestionImages(questionData).catch(() => {});
          setNextQuestion(questionData);
        } else {
          preloadQuestionImages(questionData).catch(() => {});
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
    [
      abortActiveFetch,
      abortPrefetchFetch,
      buildQuizParams,
      dailySeed,
      questionCount,
      setLoading,
      setError,
      setIsGameActive,
      setIsGameOver,
      setQuestionCount,
      setQuestion,
      setNextQuestion,
      t,
    ]
  );

  useEffect(() => {
    if (isGameActive && !question && questionCount > 0 && !loading) {
      fetchQuestion();
    }
  }, [fetchQuestion, isGameActive, loading, question, questionCount]);

  useEffect(() => {
    if (question?.round_id || question?.bonne_reponse?.id) {
      const now =
        typeof performance !== 'undefined' && typeof performance.now === 'function'
          ? performance.now()
          : Date.now();
      questionStartTimeRef.current = now;
    }
  }, [question?.round_id, question?.bonne_reponse?.id]);

  useEffect(() => {
    const roundId = question?.round_id ? String(question.round_id) : null;
    if (!roundId || lastViewedRoundIdRef.current === roundId) return;
    lastViewedRoundIdRef.current = roundId;

    void trackMetric('question_view', {
      round_id: roundId,
      question_index: Number.isInteger(questionCount) ? questionCount : null,
      mode: dailySeed ? 'easy' : normalizeGameMode(gameMode, 'easy'),
      pack_id: activePack?.id || null,
      media_type: mediaType || null,
      locale: language || 'fr',
      review: Boolean(isReviewMode),
      is_daily_challenge: Boolean(dailySeed),
    });
  }, [
    activePack?.id,
    dailySeed,
    gameMode,
    isReviewMode,
    language,
    mediaType,
    question?.round_id,
    questionCount,
  ]);

  return {
    abortActiveFetch,
    abortPrefetchFetch,
    buildQuizParams,
    fetchQuestion,
    questionStartTimeRef,
  };
}
