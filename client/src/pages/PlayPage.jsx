import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import HardMode from '../HardMode';
import EasyMode from '../components/Easymode';
import Spinner from '../components/Spinner';
import { useGame } from '../context/GameContext';

const PlayPage = () => {
  const navigate = useNavigate();
  const { isGameActive, isGameOver, loading, question, gameMode } = useGame();

  useEffect(() => {
    if (!isGameActive) {
      navigate(isGameOver ? '/end' : '/', { replace: true });
    }
  }, [isGameActive, isGameOver, navigate]);

  if (!isGameActive || loading || !question) {
    return (
      <div className="spinner-container">
        <Spinner />
      </div>
    );
  }

  return gameMode === 'easy' ? <EasyMode /> : <HardMode />;
};

export default PlayPage;

