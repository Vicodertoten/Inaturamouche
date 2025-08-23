import React from 'react';
import Modal from './Modal';
import { ACHIEVEMENTS } from '../achievements';

function AchievementModal({ achievementId, onClose }) {
  const achievement = ACHIEVEMENTS[achievementId];
  return (
    <Modal onClose={onClose}>
      <div className="achievement-modal">
        <h2 className="modal-title">🏆 Succès débloqué !</h2>
        <p>{achievement.title}</p>
      </div>
    </Modal>
  );
}

export default AchievementModal;
