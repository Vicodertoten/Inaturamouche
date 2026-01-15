import React from 'react';
import { useUser } from '../context/UserContext';
import './DailyStreakBadge.css';

const DailyStreakBadge = ({ compact = false }) => {
  const { profile } = useUser();

  if (!profile?.dailyStreak) return null;

  const { current, shields, streakBonusXP, longest, streakMilestones } = profile.dailyStreak;
  const bonusPercent = Math.round(streakBonusXP * 100);

  if (compact) {
    return (
      <div
        className="streak-badge-compact"
        aria-label={`Streak ${current} jours`}
        title={`Streak: ${current} days | Record: ${longest} days`}
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
    );
  }

  return (
    <div className="daily-streak-card">
      <div className="streak-header">
        <h3>🔥 Streak Quotidienne</h3>
        {bonusPercent > 0 && (
          <span className="xp-bonus">+{bonusPercent}% XP</span>
        )}
      </div>

      <div className="streak-display">
        <div className="flame-animation">🔥</div>
        <div className="streak-count">{current}</div>
        <div className="streak-label">jours consécutifs</div>
        <div className="streak-record">Record: {longest} jours</div>
      </div>

      <div className="shields-display">
        <span className="shields-label">Boucliers :</span>
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
        <div className="shields-help">
          <small>1 bouclier = 1 jour manqué pardonné</small>
        </div>
      </div>

      <div className="milestones">
        <h4>Paliers</h4>
        <div className="milestone-grid">
          <div className={`milestone ${current >= 7 ? 'reached' : ''}`}>
            <span className="icon">{current >= 7 ? '✅' : '🔒'}</span>
            <span className="label">7 jours → +10% XP</span>
          </div>
          <div className={`milestone ${current >= 14 ? 'reached' : ''}`}>
            <span className="icon">{current >= 14 ? '✅' : '🔒'}</span>
            <span className="label">14 jours → +20% XP</span>
          </div>
          <div className={`milestone ${current >= 30 ? 'reached' : ''}`}>
            <span className="icon">{current >= 30 ? '✅' : '🔒'}</span>
            <span className="label">30 jours → +30% XP</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DailyStreakBadge;
