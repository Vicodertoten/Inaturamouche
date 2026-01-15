import React from 'react';
import './InGameStreakDisplay.css';

/**
 * In-game streak display showing current streak, shields, and tier badge
 * @param {Object} props
 * @param {number} props.streak - Current streak value
 * @param {number} props.shields - Number of shields remaining
 * @param {Object} [props.tier] - Tier info with multiplier if active
 * @param {boolean} [props.hasPermanentShield] - Whether permanent shield is unlocked
 */
const InGameStreakDisplay = ({ streak, shields, tier, hasPermanentShield }) => {
  return (
    <div className={`in-game-streak ${tier ? 'tier-active' : ''}`}>
      <div className="streak-count">
        <span className="flame" role="img" aria-hidden="true">
          🔥
        </span>
        <span className="number">{streak}</span>
      </div>

      {tier && (
        <div className="tier-badge" style={{ '--multiplier': tier.multiplier }}>
          x{tier.multiplier}
        </div>
      )}

      {shields > 0 && (
        <div className="shields">
          {Array.from({ length: shields }).map((_, i) => (
            <span
              key={i}
              className={`shield active ${
                i === 0 && hasPermanentShield ? 'permanent' : ''
              }`}
              role="img"
              aria-hidden="true"
              title={i === 0 && hasPermanentShield ? 'Bouclier permanent (Achievement)' : ''}
            >
              🛡️
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

export default InGameStreakDisplay;
