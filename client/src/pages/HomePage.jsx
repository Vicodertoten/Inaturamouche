import { Suspense, lazy, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameData } from '../context/GameContext';

const Configurator = lazy(() => import('../Configurator'));

const dailyChallengeLabel = '\u{1F4C5} D\u00E9fi du Jour';

const LobbyPillars = ({ t, onSelectReview, canStartReview, missedCount }) => (
  <div className="lobby-pillars">
    <div className="lobby-pillar pillar-play">
      <div className="pillar-header">
        <p className="eyebrow">{t('home.play_pillar_title')}</p>
        <h3>{t('home.play_pillar_desc')}</h3>
        <p className="learn-tip">{t('home.easy_mode_description')}</p>
      </div>
    </div>
    <div className="lobby-pillar pillar-learn">
      <div className="pillar-header">
        <p className="eyebrow">{t('home.learn_pillar_title')}</p>
        <h3>{t('home.learn_pillar_desc')}</h3>
      </div>
      <div className="learn-actions">
        <button
          type="button"
          className="secondary-button"
          onClick={onSelectReview}
          disabled={!canStartReview}
        >
          {t('home.learn_action_review')}
        </button>
        <p className="learn-tip">
          {canStartReview ? t('home.learn_pillar_desc') : t('home.learn_action_review_disabled')}
        </p>
        {missedCount > 0 && (
          <div className="review-chip">
            <span className="review-count">{missedCount}</span>
            <span className="review-label">{t('common.review_mistakes')}</span>
          </div>
        )}
      </div>
    </div>
  </div>
);

const ReviewCard = ({ canStartReview, missedCount, onStartReview, t }) => (
  <div className="review-card">
    <div className="review-copy">
      <p className="review-label">{t('home.learn_pillar_title')}</p>
      <h3>{t('home.learn_action_review')}</h3>
      <p className="review-meta">
        {canStartReview ? t('home.learn_pillar_desc') : t('home.learn_action_review_disabled')}
      </p>
      <div className="review-chip">
        <p className="review-count">{missedCount}</p>
        <span className="review-label">{t('common.review_mistakes')}</span>
      </div>
    </div>
    <div className="review-actions">
      <button
        className="start-review-button"
        disabled={!canStartReview}
        onClick={onStartReview}
        type="button"
      >
        {t('common.review_mistakes')}
      </button>
    </div>
  </div>
);

const HomePage = () => {
  const navigate = useNavigate();
  const { startGame } = useGameData();

  const handleStart = useCallback(
    ({ review = false, maxQuestions, mediaType } = {}) => {
      startGame({ review, maxQuestions, mediaType });
      navigate('/play');
    },
    [navigate, startGame]
  );

  const handleDailyChallenge = useCallback(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const localDate = `${year}-${month}-${day}`;
    startGame({ seed: localDate, gameMode: 'hard', maxQuestions: 10 });
    navigate('/play');
  }, [navigate, startGame]);

  return (
    <div className="screen configurator-screen">
      <div className="home-dashboard card">
        <section className="daily-challenge-cta">
          <button
            type="button"
            className="start-button"
            onClick={handleDailyChallenge}
            aria-label={dailyChallengeLabel}
          >
            {dailyChallengeLabel}
          </button>
        </section>

        <section className="configurator-shell">
          <Suspense
            fallback={
              <div className="configurator-skeleton" aria-hidden="true">
                <div className="skeleton-block"></div>
                <div className="skeleton-line"></div>
                <div className="skeleton-line"></div>
                <div className="skeleton-line short"></div>
              </div>
            }
          >
            <Configurator onStartGame={handleStart} />
          </Suspense>
        </section>
      </div>
    </div>
  );
};

export default HomePage;
