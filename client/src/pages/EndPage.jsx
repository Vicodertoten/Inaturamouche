import { useCallback, useEffect } from 'react';
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
    dailySeed,
  } = useGameData();
  const { profile } = useUser();

  useEffect(() => {
    if (!isGameOver) navigate('/', { replace: true });
  }, [isGameOver, navigate]);

  const handleRestart = useCallback(() => {
    startGame({ seed: dailySeed });
    navigate('/play');
  }, [navigate, startGame, dailySeed]);

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
      profile={profile}
    />
  );
};

export default EndPage;
