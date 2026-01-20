import { useEffect, useMemo, useReducer, useState } from 'react';
import { initialCustomFilters, customFilterReducer } from '../../state/filterReducer';
import { DEFAULT_MAX_QUESTIONS, DEFAULT_MEDIA_TYPE } from './gameUtils';

export function useGameConfigState({ packs, packsLoading }) {
  const [activePackId, setActivePackId] = useState('custom');
  const [customFilters, dispatchCustomFilters] = useReducer(customFilterReducer, initialCustomFilters);
  const [gameMode, setGameMode] = useState('easy');
  const [maxQuestions, setMaxQuestions] = useState(DEFAULT_MAX_QUESTIONS);
  const [mediaType, setMediaType] = useState(DEFAULT_MEDIA_TYPE);
  const [dailySeed, setDailySeed] = useState(null);
  const [dailySeedSession, setDailySeedSession] = useState(null);
  const [isReviewMode, setIsReviewMode] = useState(false);
  const [reviewTaxonIds, setReviewTaxonIds] = useState([]);

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

  return {
    activePackId,
    setActivePackId,
    customFilters,
    dispatchCustomFilters,
    gameMode,
    setGameMode,
    maxQuestions,
    setMaxQuestions,
    mediaType,
    setMediaType,
    dailySeed,
    setDailySeed,
    dailySeedSession,
    setDailySeedSession,
    isReviewMode,
    setIsReviewMode,
    reviewTaxonIds,
    setReviewTaxonIds,
    activePack,
  };
}
