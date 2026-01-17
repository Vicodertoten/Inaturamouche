import React from 'react';
import Modal from './Modal';
import { ACHIEVEMENTS } from '../core/achievements';
import { useLanguage } from '../context/LanguageContext.jsx';

function AchievementModal({ achievementId, onClose }) {
  const achievement = ACHIEVEMENTS[achievementId];
  const { t } = useLanguage();
  const title = achievement?.titleKey ? t(achievement.titleKey) : achievementId;
  const description = achievement?.descriptionKey ? t(achievement.descriptionKey) : null;
  return (
    <Modal onClose={onClose}>
      <div className="achievement-modal">
        <h2 className="modal-title">🏆 {t('achievements.modal_title')}</h2>
        <p>{title}</p>
        {description && <p className="achievement-description">{description}</p>}
      </div>
    </Modal>
  );
}

export default AchievementModal;
