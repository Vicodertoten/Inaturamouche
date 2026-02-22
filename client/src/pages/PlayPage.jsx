import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import HardMode from '../features/quiz/components/HardMode';
import EasyMode from '../components/Easymode';
import QuestionSkeleton from '../components/QuestionSkeleton';
import RarityCelebration from '../components/RarityCelebration';
import { useGameData, useGameUI } from '../context/GameContext';

const PlayPage = () => {
  const navigate = useNavigate();
  const {
    isGameActive,
    isGameOver,
    question,
    gameMode,
    isStartingNewGame,
    rarityCelebration,
    setRarityCelebration,
  } = useGameData();
  const { loading } = useGameUI();

  useEffect(() => {
    if (!isGameActive && !isStartingNewGame) {
      navigate(isGameOver ? '/end' : '/', { replace: true });
    }
  }, [isGameActive, isGameOver, isStartingNewGame, navigate]);

  if (isStartingNewGame || !isGameActive || loading || !question) {
    return <QuestionSkeleton />;
  }

  const activeMode = gameMode === 'hard' ? 'hard' : 'easy';

  return (
    <>
      {rarityCelebration?.tier && (
        <RarityCelebration
          tier={rarityCelebration.tier}
          stamp={rarityCelebration.stamp}
          onComplete={() => setRarityCelebration(null)}
        />
      )}
      {activeMode === 'easy' && <EasyMode />}
      {activeMode === 'hard' && <HardMode />}
    </>
  );
};

export default PlayPage;
