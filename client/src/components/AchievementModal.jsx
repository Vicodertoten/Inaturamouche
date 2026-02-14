import React from 'react';
import Modal from './Modal';
import { 
  ACHIEVEMENTS, 
  REWARD_TYPES,
  getRewardForAchievement,
  getTitleDetails,
  getBorderDetails,
} from '../core/achievements';
import { useLanguage } from '../context/LanguageContext.jsx';
import './AchievementModal.css';

/**
 * Composant pour afficher l'icône de récompense
 */
const RewardIcon = ({ type }) => {
  switch (type) {
    case REWARD_TYPES.XP_FLAT:
      return <span className="reward-icon reward-icon-xp">✨</span>;
    case REWARD_TYPES.PERM_MULTIPLIER:
      return <span className="reward-icon reward-icon-multiplier">📈</span>;
    case REWARD_TYPES.TITLE:
      return <span className="reward-icon reward-icon-title">🏷️</span>;
    case REWARD_TYPES.BORDER:
      return <span className="reward-icon reward-icon-border">🖼️</span>;
    default:
      return null;
  }
};

/**
 * Composant pour afficher les détails de la récompense
 */
const RewardDisplay = ({ reward, t }) => {
  if (!reward) return null;

  const renderRewardContent = () => {
    switch (reward.type) {
      case REWARD_TYPES.XP_FLAT:
        return (
          <div className="reward-content reward-xp">
            <span className="reward-value">+{reward.value.toLocaleString()}</span>
            <span className="reward-label">XP</span>
          </div>
        );

      case REWARD_TYPES.PERM_MULTIPLIER:
      {
        const percent = Math.round(reward.value * 100);
        const filterLabel = reward.filter === 'all'
          ? t('rewards.all_species')
          : reward.filter;
        return (
          <div className="reward-content reward-multiplier">
            <span className="reward-value">+{percent}%</span>
            <span className="reward-label">
              {t('rewards.permanent_bonus')}
              <span className="reward-filter">{filterLabel}</span>
            </span>
          </div>
        );
      }

      case REWARD_TYPES.TITLE:
      {
        const title = getTitleDetails(reward.value);
        return (
          <div className="reward-content reward-title">
            <span className="reward-value">
              {title?.value || t(title?.nameKey) || reward.value}
            </span>
            <span className="reward-label">{t('rewards.new_title')}</span>
          </div>
        );
      }

      case REWARD_TYPES.BORDER:
      {
        const border = getBorderDetails(reward.value);
        return (
          <div className="reward-content reward-border">
            <div className={`reward-border-preview ${border?.css || ''}`}>
              <span className="reward-border-sample">🎨</span>
            </div>
            <span className="reward-label">{t('rewards.new_border')}</span>
          </div>
        );
      }

      default:
        return null;
    }
  };

  return (
    <div className="reward-display">
      <RewardIcon type={reward.type} />
      {renderRewardContent()}
    </div>
  );
};

function AchievementModal({ achievementId, onClose }) {
  const achievement = ACHIEVEMENTS[achievementId];
  const { t } = useLanguage();
  const title = achievement?.titleKey ? t(achievement.titleKey) : achievementId;
  const description = achievement?.descriptionKey ? t(achievement.descriptionKey) : null;
  const icon = achievement?.icon || '🏆';
  const reward = getRewardForAchievement(achievementId);

  return (
    <Modal onClose={onClose}>
      <div className="achievement-modal">
        <div className="achievement-header">
          <span className="achievement-icon" aria-hidden="true">{icon}</span>
          <h2 className="modal-title">{t('achievements.modal_title')}</h2>
        </div>
        
        <div className="achievement-body">
          <p className="achievement-name">{title}</p>
          {description && (
            <p className="achievement-description">{description}</p>
          )}
        </div>

        {reward && (
          <div className="achievement-reward">
            <h3 className="reward-heading">{t('achievements.reward_label')}</h3>
            <RewardDisplay reward={reward} t={t} />
          </div>
        )}
        
        <button className="achievement-close-btn" onClick={onClose}>
          {t('common.ok')}
        </button>
      </div>
    </Modal>
  );
}

export default AchievementModal;
