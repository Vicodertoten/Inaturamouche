import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Configurator from '../Configurator';
import { useGame } from '../context/GameContext';
import { useLanguage } from '../context/LanguageContext.jsx';

const HomePage = () => {
  const navigate = useNavigate();
  const { gameMode, setGameMode, startGame } = useGame();
  const { t } = useLanguage();

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
            data-tooltip={t('home.easy_mode_description')}
            onPointerLeave={(event) => event.currentTarget.blur()}
            title={t('home.easy_mode_description')}
          >
            {t('home.easy_mode')}
          </button>
          <button
            onClick={() => setGameMode('hard')}
            className={`tooltip ${gameMode === 'hard' ? 'active' : ''}`}
            data-tooltip={t('home.hard_mode_description')}
            onPointerLeave={(event) => event.currentTarget.blur()}
            title={t('home.hard_mode_description')}
          >
            {t('home.hard_mode')}
          </button>
        </div>

        <Configurator onStartGame={() => handleStart(false)} onStartReview={() => handleStart(true)} />
      </div>
    </div>
  );
};

export default HomePage;
