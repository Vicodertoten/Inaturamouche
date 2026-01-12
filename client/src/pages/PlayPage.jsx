import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import HardMode from '../HardMode';
import EasyMode from '../components/Easymode';
import QuestionSkeleton from '../components/QuestionSkeleton';
import { useGameData, useGameUI } from '../context/GameContext';

const PlayPage = () => {
  const navigate = useNavigate();
  const { isGameActive, isGameOver, question, gameMode } = useGameData();
  const { loading } = useGameUI();

  useEffect(() => {
    if (!isGameActive) {
      navigate(isGameOver ? '/end' : '/', { replace: true });
    }
  }, [isGameActive, isGameOver, navigate]);

  if (!isGameActive || loading || !question) {
    return <QuestionSkeleton />;
  }

  return gameMode === 'easy' ? <EasyMode /> : <HardMode />;
};

export default PlayPage;
