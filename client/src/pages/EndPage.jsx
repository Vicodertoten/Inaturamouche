import { useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import EndScreen from '../components/EndScreen';
import { useGameData } from '../context/GameContext';
import { useUser } from '../context/UserContext';

const EndPage = () => {
  const navigate = useNavigate();
  const {
    isGameOver,
    score,
    sessionCorrectSpecies,
    sessionSpeciesData,
    newlyUnlocked,
    startGame,
    resetToLobby,
    clearSessionFromDB,
    dailySeed,
    isReviewMode,
    gameMode,
    maxQuestions,
    mediaType,
  } = useGameData();
  const { profile } = useUser();
  const isRestartingRef = useRef(false);

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
    isRestartingRef.current = true;
    const restartConfig = {
      review: isReviewMode,
      gameMode,
      maxQuestions,
      mediaType,
    };
    if (dailySeed) {
      restartConfig.seed = dailySeed;
    }
    startGame(restartConfig);
    navigate('/play');
  }, [dailySeed, gameMode, isReviewMode, maxQuestions, mediaType, navigate, startGame]);

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
    />
  );
};

export default EndPage;
