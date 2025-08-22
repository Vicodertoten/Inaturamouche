import React from 'react';
import './StreakBadge.css';

const StreakBadge = ({ streak }) => {
  if (streak <= 0) return null;

  return (
    <div className="streak-badge" aria-label={`S\u00e9rie de ${streak} bonnes r\u00e9ponses`}>
      <span className="streak-icon" role="img" aria-hidden="true">🔥</span>
      <span className="streak-count">{streak}</span>
    </div>
  );
};

export default StreakBadge;
