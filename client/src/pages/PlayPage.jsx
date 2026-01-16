import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import HardMode from '../features/quiz/components/HardMode';
import EasyMode from '../components/Easymode';
import QuestionSkeleton from '../components/QuestionSkeleton';
import { useGameData, useGameUI } from '../context/GameContext';

const PlayPage = () => {
  const navigate = useNavigate();
  const { isGameActive, isGameOver, question, gameMode, isStartingNewGame } = useGameData();
  const { loading } = useGameUI();

  useEffect(() => {
    if (!isGameActive && !isStartingNewGame) {
      navigate(isGameOver ? '/end' : '/', { replace: true });
    }
  }, [isGameActive, isGameOver, isStartingNewGame, navigate]);

  if (isStartingNewGame || !isGameActive || loading || !question) {
    return <QuestionSkeleton />;
  }

  return gameMode === 'easy' ? <EasyMode /> : <HardMode />;
};

export default PlayPage;
