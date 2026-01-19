import { useCallback, useState } from 'react';
import { useLanguage } from '../context/LanguageContext.jsx';
import './ReviewDashboardCard.css';

const ReviewDashboardCard = ({ dueToday = 0, onStartReview }) => {
  const { t } = useLanguage();
  const [isStarting, setIsStarting] = useState(false);

  const handleStart = useCallback(async () => {
    if (isStarting) return;
    setIsStarting(true);
    try {
      const started = await onStartReview?.();
      if (!started) {
        setIsStarting(false);
      }
    } catch {
      setIsStarting(false);
    }
  }, [isStarting, onStartReview]);

  const handleKeyDown = useCallback(
    (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        handleStart();
      }
    },
    [handleStart]
  );

  return (
    <div
      className={`review-dashboard-card${isStarting ? ' is-starting' : ''}`}
      role="button"
      tabIndex={0}
      onClick={handleStart}
      onKeyDown={handleKeyDown}
      aria-busy={isStarting}
      aria-label={t('review.start_button', {}, 'Start Review')}
    >
      <div className="review-dashboard-content">
        <div className="review-dashboard-header">
          <span className="review-dashboard-eyebrow">
            {t('review.title', {}, 'Review Mode')}
          </span>
          <span className="review-dashboard-badge">XP Bonus (+25%)</span>
        </div>
        <h3 className="review-dashboard-title">{t('common.review_mistakes')}</h3>
        <p className="review-dashboard-subtitle">
          {t('profile.review_due_today', {}, 'Species due today')}
        </p>
        <div className="review-dashboard-count">
          <span className="count-value">{dueToday}</span>
          <span className="count-label">
            {t('review.due_today_label', {}, 'Ready for review')}
          </span>
        </div>
      </div>
      <div className="review-dashboard-actions">
        <button
          type="button"
          className="btn btn--primary review-dashboard-button"
          onClick={(event) => {
            event.stopPropagation();
            handleStart();
          }}
          disabled={isStarting}
        >
          {isStarting ? t('review.starting', {}, 'Starting...') : t('review.start_button', {}, 'Start Review')}
        </button>
        <p className="review-dashboard-hint">
          {t('review.action_hint', {}, 'A quick, focused session to lock in what you know.')}
        </p>
      </div>
    </div>
  );
};

export default ReviewDashboardCard;
