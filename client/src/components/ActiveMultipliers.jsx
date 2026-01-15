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
  perksMultiplier = 1.0,
  winStreakBonus = 0,
  timerBonus = 0 
}) => {
  const [showTooltip, setShowTooltip] = useState(false);

  // Calcul du multiplicateur total
  const baseMultiplier = 1.0 + dailyStreakBonus + winStreakBonus + timerBonus;
  const totalMultiplier = baseMultiplier * perksMultiplier;

  // Ne pas afficher si multiplicateur = 1.0 (aucun bonus)
  if (totalMultiplier <= 1.0) {
    return null;
  }

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
                <span className="multiplier-item-label">Victoires consécutives</span>
                <span className="multiplier-item-value">
                  +{(winStreakBonus * 100).toFixed(0)}%
                </span>
              </div>
            )}

            {perksMultiplier > 1.0 && (
              <div className="multiplier-item">
                <span className="multiplier-item-icon">🎯</span>
                <span className="multiplier-item-label">Perks</span>
                <span className="multiplier-item-value">
                  x{perksMultiplier.toFixed(2)}
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
  perksMultiplier: PropTypes.number,
  winStreakBonus: PropTypes.number,
  timerBonus: PropTypes.number,
};

export default ActiveMultipliers;
