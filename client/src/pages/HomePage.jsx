import { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Configurator from '../Configurator';
import { useGame } from '../context/GameContext';
import { useLanguage } from '../context/LanguageContext.jsx';
import { useUser } from '../context/UserContext.jsx';

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
  const { startGame, canStartReview, setActivePackId } = useGame();
  const { profile } = useUser();
  const { t } = useLanguage();

  const missedCount = profile?.stats?.missedSpecies?.length || 0;
  const totalXp = profile?.xp || 0;

  const handleStart = useCallback(
    ({ review = false, maxQuestions, mediaType } = {}) => {
      startGame({ review, maxQuestions, mediaType });
      navigate('/play');
    },
    [navigate, startGame]
  );

  const handleSelectReview = useCallback(() => {
    setActivePackId('review');
  }, [setActivePackId]);

  const handleStartReview = useCallback(() => {
    handleSelectReview();
    handleStart({ review: true });
  }, [handleSelectReview, handleStart]);

  const heroChips = useMemo(
    () => [
      {
        label: t('common.review_mistakes'),
        value: missedCount,
      },
      {
        label: t('common.score'),
        value: totalXp,
      },
    ],
    [missedCount, t, totalXp]
  );

  return (
    <div className="screen configurator-screen">
      <div className="home-dashboard card">
        
        <section className="configurator-shell">
          <Configurator onStartGame={handleStart} />
        </section>
      </div>
    </div>
  );
};

export default HomePage;
