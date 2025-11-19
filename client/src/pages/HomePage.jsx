import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Configurator from '../Configurator';
import { useGame } from '../context/GameContext';

const HomePage = () => {
  const navigate = useNavigate();
  const { gameMode, setGameMode, startGame } = useGame();

  const handleStart = useCallback(
    (review = false) => {
      startGame({ review });
      navigate('/play');
    },
    [navigate, startGame]
  );

  return (
    <div className="screen configurator-screen">
      <div className="card">
        <div className="mode-selector">
          <button
            onClick={() => setGameMode('easy')}
            className={`tooltip ${gameMode === 'easy' ? 'active' : ''}`}
            data-tooltip="Mode facile : quatre propositions et indice facultatif"
            onPointerLeave={(event) => event.currentTarget.blur()}
            title="Mode facile : quatre propositions et indice facultatif"
          >
            Facile
          </button>
          <button
            onClick={() => setGameMode('hard')}
            className={`tooltip ${gameMode === 'hard' ? 'active' : ''}`}
            data-tooltip="Mode difficile : devinez la taxonomie avec essais limités"
            onPointerLeave={(event) => event.currentTarget.blur()}
            title="Mode difficile : devinez la taxonomie avec essais limités"
          >
            Difficile
          </button>
        </div>

        <Configurator onStartGame={() => handleStart(false)} onStartReview={() => handleStart(true)} />
      </div>
    </div>
  );
};

export default HomePage;

