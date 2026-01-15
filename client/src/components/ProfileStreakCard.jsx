import React from 'react';
import './ProfileStreakCard.css';

const STREAK_MILESTONES = [3, 5, 10, 20, 50];

const getNextStreakMilestone = (current) => {
  const next = STREAK_MILESTONES.find((m) => m > current);
  return next || 'MAX';
};

const getStreakProgress = (current) => {
  const next = getNextStreakMilestone(current);
  if (next === 'MAX') return 100;

  const previous = [...STREAK_MILESTONES].reverse().find((m) => m < current) || 0;
  return ((current - previous) / (next - previous)) * 100;
};

/**
 * Profile streak card displaying global streak statistics
 * @param {Object} props
 * @param {number} props.currentStreak - Current global streak
 * @param {number} props.longestStreak - Longest streak achieved
 * @param {boolean} [props.hasPermanentShield] - Whether permanent shield is unlocked
 */
const ProfileStreakCard = ({ currentStreak, longestStreak, hasPermanentShield }) => {
  const nextMilestone = getNextStreakMilestone(longestStreak);
  const progress = getStreakProgress(longestStreak);

  return (
    <div className="profile-streak-card">
      <div className="streak-header">
        <h3>
          <span role="img" aria-hidden="true">
            🔥
          </span>
          {' '}Streak Global
        </h3>
        {hasPermanentShield && (
          <span
            className="permanent-badge"
            title="Gardien Éternel débloqué"
            role="img"
            aria-label="Gardien Éternel débloqué"
          >
            🛡️ Gardien
          </span>
        )}
      </div>

      <div className="streak-stats">
        <div className="stat-box current">
          <span className="label">Actuel</span>
          <span className="value">{currentStreak}</span>
        </div>

        <div className="stat-box record">
          <span className="label">Record</span>
          <span className="value">{longestStreak}</span>
        </div>
      </div>

      <div className="streak-progress">
        <div className="progress-label">
          Prochain objectif : {nextMilestone === 'MAX' ? 'MAX' : `${nextMilestone}`}
        </div>
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${progress}%` }} />
        </div>
      </div>
    </div>
  );
};

export default ProfileStreakCard;
