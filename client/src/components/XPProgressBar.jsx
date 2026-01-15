import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useLevelProgress } from '../hooks/useLevelProgress';
import './XPProgressBar.css';

/**
 * Barre de progression XP avec animations
 * @param {number} currentXP - XP total actuel
 * @param {number} recentXPGain - XP gagné récemment (pour animation)
 * @param {boolean} showDetailed - Afficher les détails (XP, niveau)
 * @param {boolean} animate - Activer les animations
 * @param {string} size - Taille du composant ('default' | 'compact')
 */
const XPProgressBar = ({ 
  currentXP = 0, 
  recentXPGain = 0, 
  showDetailed = true,
  animate = true,
  size = 'default'
}) => {
  const { level, nextLevel, xpProgress, xpNeeded, progressPercent } = useLevelProgress(currentXP);
  const [showXPPopup, setShowXPPopup] = useState(false);
  const [displayedProgress, setDisplayedProgress] = useState(progressPercent);
  const [isAnimating, setIsAnimating] = useState(false);

  // Animation du popup "+X XP"
  useEffect(() => {
    if (recentXPGain > 0 && animate) {
      setShowXPPopup(true);
      const timer = setTimeout(() => setShowXPPopup(false), 2000);
      return () => clearTimeout(timer);
    }
    // Note: We don't explicitly set false here to avoid unnecessary re-renders
    // The timeout handler will set it to false when needed
  }, [recentXPGain, animate]);

  // Animation progressive de la barre
  useEffect(() => {
    if (animate && Math.abs(displayedProgress - progressPercent) > 0.1) {
      setIsAnimating(true);
      const timer = setTimeout(() => {
        setDisplayedProgress(progressPercent);
      }, 100);
      const animTimer = setTimeout(() => {
        setIsAnimating(false);
      }, 1000);
      return () => {
        clearTimeout(timer);
        clearTimeout(animTimer);
      };
    } else if (!animate) {
      setDisplayedProgress(progressPercent);
    }
  }, [progressPercent, animate, displayedProgress]);

  const isCompact = size === 'compact';

  return (
    <div className={`xp-progress-container ${isCompact ? 'xp-progress-compact' : ''}`}>
      {/* Header avec niveau et XP */}
      {showDetailed && (
        <div className="xp-progress-header">
          <div className="xp-level-badge">
            <span className="xp-level-label">Niveau</span>
            <span className="xp-level-value">{level}</span>
          </div>
          <div className="xp-details">
            <span className="xp-current">{xpProgress.toLocaleString()}</span>
            <span className="xp-separator">/</span>
            <span className="xp-total">{xpNeeded.toLocaleString()} XP</span>
          </div>
        </div>
      )}

      {/* Version compacte : afficher XP/XP nécessaire */}
      {isCompact && (
        <div className="xp-compact-details">
          <span className="xp-compact-text">
            {xpProgress.toLocaleString()} / {xpNeeded.toLocaleString()} XP
          </span>
        </div>
      )}

      {/* Barre de progression */}
      <div className="xp-progress-bar-wrapper">
        <div className="xp-progress-bar-track">
          <div 
            className={`xp-progress-bar-fill ${isAnimating ? 'animating' : ''}`}
            style={{ width: `${displayedProgress}%` }}
          >
            <div className="xp-progress-bar-shine"></div>
          </div>
        </div>
        
        {/* Indicateur du prochain niveau */}
        {!isCompact && (
          <div className="xp-next-level">
            Niveau {nextLevel}
          </div>
        )}
      </div>



      {/* Popup "+X XP" */}
      {showXPPopup && recentXPGain > 0 && (
        <div className="xp-gain-popup">
          +{recentXPGain} XP
        </div>
      )}
    </div>
  );
};

XPProgressBar.propTypes = {
  currentXP: PropTypes.number,
  recentXPGain: PropTypes.number,
  showDetailed: PropTypes.bool,
  animate: PropTypes.bool,
  size: PropTypes.oneOf(['default', 'compact']),
};

export default XPProgressBar;
