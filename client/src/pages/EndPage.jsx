import { useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import EndScreen from '../components/EndScreen';
import { useGameData } from '../context/GameContext';
import { useUser } from '../context/UserContext';
import { markDailyCompleted } from '../utils/dailyChallenge';

const EndPage = () => {
  const navigate = useNavigate();
  const {
    isGameOver,
    score,
    sessionCorrectSpecies,
    sessionSpeciesData,
    newlyUnlocked,
    startGame,
    clearSessionFromDB,
    dailySeed,
    isChallenge,
    isReviewMode,
    gameMode,
    maxQuestions,
    mediaType,
    activePackId,
  } = useGameData();
  const { profile } = useUser();
  const isRestartingRef = useRef(false);
  const isDailyChallenge = Boolean(dailySeed) && !isChallenge;

  // Mark daily challenge as completed when reaching the end screen
  useEffect(() => {
    if (isGameOver && dailySeed) {
      markDailyCompleted(dailySeed);
    }
  }, [isGameOver, dailySeed]);

  useEffect(() => {
    if (!isGameOver) {
      if (isRestartingRef.current) {
        isRestartingRef.current = false;
        return;
      }
      navigate('/', { replace: true });
    }
  }, [isGameOver, navigate]);

  const handleRestart = useCallback(() => {
    // Daily challenges cannot be replayed
    if (isDailyChallenge) {
      navigate('/');
      return;
    }
    isRestartingRef.current = true;
    const restartConfig = {
      review: isReviewMode,
      gameMode,
      maxQuestions,
      mediaType,
    };
    startGame(restartConfig);
    navigate('/play');
  }, [isDailyChallenge, gameMode, isReviewMode, maxQuestions, mediaType, navigate, startGame]);

  const handleReturnHome = useCallback(() => {
    // Ensure the saved session is removed so it cannot be resumed later
    clearSessionFromDB().catch((err) => console.error('[EndPage] Failed to clear session:', err));
    navigate('/');
  }, [navigate, clearSessionFromDB]);

  if (!isGameOver) return null;

  return (
    <EndScreen
      score={score}
      sessionCorrectSpecies={sessionCorrectSpecies}
      sessionSpeciesData={sessionSpeciesData}
      newlyUnlocked={newlyUnlocked}
      onRestart={handleRestart}
      onReturnHome={handleReturnHome}
      profile={profile}
      isDailyChallenge={isDailyChallenge}
      activePackId={activePackId}
      gameMode={gameMode}
      maxQuestions={maxQuestions}
      mediaType={mediaType}
    />
  );
};

export default EndPage;
