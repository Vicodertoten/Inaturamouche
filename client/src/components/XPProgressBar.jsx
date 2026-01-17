import React, { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { useLevelProgress } from '../hooks/useLevelProgress';
import { getLevelFromXp, getXpForLevel } from '../utils/scoring';
import './XPProgressBar.css';

/**
 * Barre de progression XP avec animations multi-level up
 * @param {number} currentXP - XP total actuel
 * @param {number} startXP - XP initial (pour l'animation depuis le dernier état)
 * @param {number} recentXPGain - XP gagné récemment (pour animation)
 * @param {boolean} showDetailed - Afficher les détails (XP, niveau)
 * @param {boolean} animate - Activer les animations
 * @param {string} size - Taille du composant ('default' | 'compact')
 * @param {Function} onLevelUp - Callback appelé quand on atteint un nouveau niveau
 */
const XPProgressBar = ({ 
  currentXP = 0, 
  startXP = null,
  recentXPGain = 0, 
  showDetailed = true,
  animate = true,
  size = 'default',
  onLevelUp = null,
}) => {
  // If a startXP is provided we will animate the bar from startXP -> currentXP
  const initialXP = startXP == null ? currentXP : startXP;
  const [displayedXP, setDisplayedXP] = useState(initialXP);
  const { level, nextLevel, xpProgress, xpNeeded, progressPercent } = useLevelProgress(displayedXP);
  const [showXPPopup, setShowXPPopup] = useState(false);
  const [displayedProgress, setDisplayedProgress] = useState(progressPercent);
  const [isAnimating, setIsAnimating] = useState(false);
  const [currentLevel, setCurrentLevel] = useState(getLevelFromXp(initialXP));
  const [levelUpQueue, setLevelUpQueue] = useState([]);

  // Détecter les level-ups et les ajouter à la queue
  useEffect(() => {
    if (!animate || startXP == null) return;
    
    const startLevel = getLevelFromXp(startXP);
    const endLevel = getLevelFromXp(currentXP);
    
    if (endLevel > startLevel) {
      const newLevels = [];
      for (let lvl = startLevel + 1; lvl <= endLevel; lvl++) {
        newLevels.push(lvl);
      }
      setLevelUpQueue(newLevels);
    }
  }, [startXP, currentXP, animate]);

  // Animation du popup "+X XP"
  useEffect(() => {
    if (recentXPGain > 0 && animate) {
      setShowXPPopup(true);
      const timer = setTimeout(() => setShowXPPopup(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [recentXPGain, animate]);

  // Animation progressive de la barre
  // Sync displayedProgress when progressPercent for displayedXP changes
  useEffect(() => {
    if (animate && Math.abs(displayedProgress - progressPercent) > 0.1) {
      setIsAnimating(true);
      const timer = setTimeout(() => setDisplayedProgress(progressPercent), 100);
      const animTimer = setTimeout(() => setIsAnimating(false), 1000);
      return () => { clearTimeout(timer); clearTimeout(animTimer); };
    } else if (!animate) {
      setDisplayedProgress(progressPercent);
    }
  }, [progressPercent, animate, displayedProgress]);

  // Si startXP est fourni, animer displayedXP de start -> currentXP
  // Avec gestion multi-level: remplir jusqu'au niveau suivant, reset, etc.
  useEffect(() => {
    if (startXP == null || !animate) {
      setDisplayedXP(currentXP);
      setCurrentLevel(getLevelFromXp(currentXP));
      return;
    }

    if (currentXP === startXP) return;

    let rafId = null;
    let isRunning = true;
    const duration = 1200;
    const startTime = performance.now();
    const from = startXP;
    const to = currentXP;

    const step = (now) => {
      if (!isRunning) return;
      
      const t = Math.min(1, (now - startTime) / duration);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - t, 3);
      const nextXP = Math.round(from + (to - from) * eased);
      const nextLevel = getLevelFromXp(nextXP);
      
      // Trigger level-up callback si on vient de changer de niveau
      if (nextLevel > currentLevel && onLevelUp) {
        onLevelUp(nextLevel);
        setCurrentLevel(nextLevel);
      } else if (nextLevel !== currentLevel) {
        setCurrentLevel(nextLevel);
      }
      
      setDisplayedXP(nextXP);
      
      if (t < 1) {
        rafId = requestAnimationFrame(step);
      }
    };

    rafId = requestAnimationFrame(step);
    return () => { 
      isRunning = false;
      if (rafId) cancelAnimationFrame(rafId); 
    };
  }, [startXP, currentXP, animate, currentLevel, onLevelUp]);

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
