import React from 'react';
import PropTypes from 'prop-types';
import './LevelUpNotification.css';

/**
 * Notification de level up qui apparaît en haut de l'écran
 * @param {number} oldLevel - Ancien niveau
 * @param {number} newLevel - Nouveau niveau
 * @param {Function} onClose - Callback de fermeture
 */
const LevelUpNotification = ({ oldLevel, newLevel, onClose }) => {
  return (
    <div className="level-up-notification" onClick={onClose}>
      <div className="level-up-content">
        <div className="level-up-icon">🎉</div>
        <div className="level-up-text">
          <div className="level-up-title">Level Up!</div>
          <div className="level-up-levels">
            Niveau {oldLevel} → {newLevel}
          </div>
        </div>
      </div>
      <div className="level-up-sparkles">
        {Array.from({ length: 8 }).map((_, i) => (
          <span key={i} className="sparkle" style={{ '--delay': `${i * 0.1}s` }} />
        ))}
      </div>
    </div>
  );
};

LevelUpNotification.propTypes = {
  oldLevel: PropTypes.number.isRequired,
  newLevel: PropTypes.number.isRequired,
  onClose: PropTypes.func,
};

export default LevelUpNotification;
