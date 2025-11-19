import React from 'react';
import './StreakBadge.css';
import { useLanguage } from '../context/LanguageContext.jsx';

const StreakBadge = ({ streak }) => {
  const { t } = useLanguage();
  if (streak <= 0) return null;

  return (
    <div className="streak-badge" aria-label={t('streak.aria_label', { count: streak })}>
      <span className="streak-icon" role="img" aria-hidden="true">🔥</span>
      <span className="streak-count">{streak}</span>
    </div>
  );
};

export default StreakBadge;
