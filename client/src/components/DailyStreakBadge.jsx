import React from 'react';
import { useUser } from '../context/UserContext';
import { useLanguage } from '../context/LanguageContext.jsx';
import './DailyStreakBadge.css';

const DailyStreakBadge = ({ compact = false }) => {
  const { profile } = useUser();
  const { t } = useLanguage();

  if (!profile?.dailyStreak) return null;

  const { current, shields, longest } = profile.dailyStreak;

  if (compact) {
    return (
      <div className="streak-badge-container">
        <div
          className="streak-badge-compact"
          aria-label={t('streak.days_label', { count: current }, `Streak ${current} jours`)}
          title={t('streak.tooltip', { current, longest }, `Streak: ${current} jours | Record: ${longest} jours`)}
        >
          <span className="flame">🔥</span>
          <span className="count">{current}</span>
          {shields > 0 && (
            <span className="shields">
              {Array.from({ length: shields }).map((_, i) => (
                <span key={i} className="shield-icon">
                  🛡️
                </span>
              ))}
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="streak-badge-container">
      <div className="daily-streak-card">
        <div className="streak-header">
          <h3> {t('streak.daily_title', {}, 'Streak Quotidienne')}</h3>
        </div>

        <div className="streak-display">
          <div className="streak-count-inline">
            <span className="count-number">{current}</span>
            <span className="count-label">{t('streak.days_unit', {}, 'jours')}</span>
          </div>
          
        </div>

        <div className="shields-display">
          <span className="shields-label">{t('streak.shields_label', {}, 'Boucliers :')}</span>
          <div className="shields-icons">
            {Array.from({ length: 3 }).map((_, i) => (
              <span
                key={i}
                className={`shield ${i < shields ? 'active' : 'inactive'}`}
              >
                {i < shields ? '🛡️' : '⚪'}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DailyStreakBadge;