import { useCallback } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import Configurator from '../Configurator';
import { useGame } from '../context/GameContext';
import { useLanguage } from '../context/LanguageContext.jsx';

const HomePage = () => {
  const navigate = useNavigate();
  const { gameMode, setGameMode, startGame, canStartReview } = useGame();
  const { t } = useLanguage();
  const { showHelp } = useOutletContext() || {};

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
        <div className="lobby-pillars">
          <section className="lobby-pillar play-pillar">
            <div className="pillar-header">
              <h3>{t('home.play_pillar_title')}</h3>
              <p>{t('home.play_pillar_desc')}</p>
            </div>
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
          </section>

          <section className="lobby-pillar learn-pillar">
            <div className="pillar-header">
              <h3>{t('home.learn_pillar_title')}</h3>
              <p>{t('home.learn_pillar_desc')}</p>
            </div>
            <div className="learn-actions">
              {showHelp && (
                <button className="secondary-button" type="button" onClick={showHelp}>
                  {t('home.learn_action_help')}
                </button>
              )}
              <button
                className="secondary-button"
                type="button"
                onClick={() => handleStart(true)}
                disabled={!canStartReview}
                title={!canStartReview ? t('home.learn_action_review_disabled') : undefined}
              >
                {t('home.learn_action_review')}
              </button>
              {!canStartReview && (
                <p className="learn-tip">{t('home.learn_action_review_disabled')}</p>
              )}
            </div>
          </section>
        </div>

        <Configurator onStartGame={() => handleStart(false)} />
      </div>
    </div>
  );
};

export default HomePage;
