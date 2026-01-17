import { useState, useEffect } from 'react';
import { getReviewStats } from '../services/CollectionService';
import { useGameData } from '../context/GameContext';
import { useLanguage } from '../context/LanguageContext.jsx';
import './ReviewCard.css';

const ReviewCard = () => {
  const [stats, setStats] = useState(null);
  const { startReviewMode } = useGameData();
  const { t } = useLanguage();
  
  useEffect(() => {
    const loadStats = async () => {
      const reviewStats = await getReviewStats();
      setStats(reviewStats);
    };
    
    loadStats();
    
    // Refresh every hour
    const interval = setInterval(loadStats, 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);
  
  if (!stats || stats.dueToday === 0) {
    return (
      <div className="review-card card empty">
        <div className="review-icon">✅</div>
        <div className="review-message">
          {t('review.empty_message', {}, "Aucune révision aujourd'hui !")}
        </div>
        <div className="review-next">
          {stats?.dueTomorrow > 0 && (
            <small>{t('review.tomorrow', { count: stats.dueTomorrow }, `Demain : ${stats.dueTomorrow} espèce${stats.dueTomorrow > 1 ? 's' : ''}`)}</small>
          )}
        </div>
      </div>
    );
  }
  
  return (
    <div className="review-card card active">
      <div className="review-header">
        <div className="review-icon">📚</div>
        <h3>{t('review.title', {}, 'Révision')}</h3>
      </div>
      
      <div className="review-count">
        <div className="count-number">{stats.dueToday}</div>
        <div className="count-label">
          espèce{stats.dueToday > 1 ? 's' : ''} à réviser
        </div>
      </div>
      
      <div className="review-actions">
        <button onClick={startReviewMode} className="btn btn--primary review-button">
          {t('review.start_button', {}, 'Commencer la Révision')}
        </button>
      </div>
      
      <div className="review-stats">
        <div className="review-stat">
          <span className="stat-label">Demain</span>
          <span className="stat-value">{stats.dueTomorrow}</span>
        </div>
        <div className="review-stat">
          <span className="stat-label">En révision</span>
          <span className="stat-value">{stats.totalInReviewSystem}</span>
        </div>
      </div>
    </div>
  );
};

export default ReviewCard;
