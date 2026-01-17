import React, { useState } from 'react';
import PropTypes from 'prop-types';
import './ActiveMultipliers.css';

/**
 * Affiche le badge des multiplicateurs actifs avec tooltip
 * @param {number} dailyStreakBonus - Bonus de la streak quotidienne (0.0 - 1.0)
 * @param {number} perksMultiplier - Multiplicateur des perks (1.0+)
 * @param {number} winStreakBonus - Bonus de la winstreak (0.0 - 0.5)
 * @param {number} timerBonus - Bonus du timer (0.0 - 1.0)
 */
const ActiveMultipliers = ({ 
  dailyStreakBonus = 0, 
  winStreakBonus = 0,
  timerBonus = 0 
}) => {
  const [showTooltip, setShowTooltip] = useState(false);

  // Calcul du multiplicateur total (sans perks)
  const totalMultiplier = 1.0 + dailyStreakBonus + winStreakBonus + timerBonus;

  // Toujours afficher le multiplicateur

  const handleMouseEnter = () => setShowTooltip(true);
  const handleMouseLeave = () => setShowTooltip(false);
  const handleClick = () => setShowTooltip(!showTooltip);

  return (
    <div 
      className="active-multipliers"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      aria-label={`Multiplicateur actif: x${totalMultiplier.toFixed(2)}`}
    >
      <div className="multiplier-badge">
        <span className="multiplier-icon">⚡</span>
        <span className="multiplier-value">x{totalMultiplier.toFixed(2)}</span>
      </div>

      {showTooltip && (
        <div className="multiplier-tooltip">
          <div className="multiplier-tooltip-header">
            <span className="multiplier-tooltip-icon">⚡</span>
            <span className="multiplier-tooltip-title">Multiplicateurs Actifs</span>
          </div>
          
          <div className="multiplier-tooltip-content">
            {dailyStreakBonus > 0 && (
              <div className="multiplier-item">
                <span className="multiplier-item-icon">🔥</span>
                <span className="multiplier-item-label">Streak quotidienne</span>
                <span className="multiplier-item-value">
                  +{(dailyStreakBonus * 100).toFixed(0)}%
                </span>
              </div>
            )}

            {winStreakBonus > 0 && (
              <div className="multiplier-item">
                <span className="multiplier-item-icon">🏆</span>
                <span className="multiplier-item-label">Combo streak</span>
                <span className="multiplier-item-value">
                  +{(winStreakBonus * 100).toFixed(0)}%
                </span>
              </div>
            )}

            {timerBonus > 0 && (
              <div className="multiplier-item">
                <span className="multiplier-item-icon">⏱️</span>
                <span className="multiplier-item-label">Bonus temps</span>
                <span className="multiplier-item-value">
                  +{(timerBonus * 100).toFixed(0)}%
                </span>
              </div>
            )}

            {totalMultiplier === 1.0 && (
              <div className="multiplier-item no-bonus">
                <span className="multiplier-item-icon">💡</span>
                <span className="multiplier-item-label">Aucun bonus actif</span>
              </div>
            )}

            <div className="multiplier-total">
              <span className="multiplier-total-label">Total</span>
              <span className="multiplier-total-value">
                x{totalMultiplier.toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

ActiveMultipliers.propTypes = {
  dailyStreakBonus: PropTypes.number,
  winStreakBonus: PropTypes.number,
  timerBonus: PropTypes.number,
};

export default ActiveMultipliers;
