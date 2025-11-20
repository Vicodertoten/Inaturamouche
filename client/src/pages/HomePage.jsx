import { useCallback } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import Configurator from '../Configurator';
import { useGame } from '../context/GameContext';
import { useLanguage } from '../context/LanguageContext.jsx';
import { useUser } from '../context/UserContext.jsx';

const HomePage = () => {
  const navigate = useNavigate();
  const { startGame, canStartReview } = useGame();
  const { profile } = useUser();
  const { t } = useLanguage();
  const { showHelp } = useOutletContext() || {};
  const missedCount = profile?.stats?.missedSpecies?.length || 0;

  const handleStart = useCallback(
    (review = false) => {
      startGame({ review });
      navigate('/play');
    },
    [navigate, startGame]
  );

  return (
    <div className="screen configurator-screen">
      <div className="home-dashboard card">
        <div className="dashboard-header">
          
          {showHelp && (
            <button className="secondary-button" type="button" onClick={showHelp}>
              {t('home.learn_action_help')}
            </button>
          )}
        </div>

        

        <section className="configurator-shell">
          <Configurator onStartGame={() => handleStart(false)} />
        </section>
      </div>
    </div>
  );
};

export default HomePage;
