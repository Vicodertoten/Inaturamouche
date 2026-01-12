import { useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import EndScreen from '../components/EndScreen';
import { useGameData } from '../context/GameContext';

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
  } = useGameData();

  useEffect(() => {
    if (!isGameOver) navigate('/', { replace: true });
  }, [isGameOver, navigate]);

  const handleRestart = useCallback(() => {
    startGame();
    navigate('/play');
  }, [navigate, startGame]);

  const handleReturnHome = useCallback(() => {
    resetToLobby(true);
    navigate('/');
  }, [navigate, resetToLobby]);

  if (!isGameOver) return null;

  return (
    <EndScreen
      score={score}
      sessionCorrectSpecies={sessionCorrectSpecies}
      sessionSpeciesData={sessionSpeciesData}
      newlyUnlocked={newlyUnlocked}
      onRestart={handleRestart}
      onReturnHome={handleReturnHome}
    />
  );
};

export default EndPage;
