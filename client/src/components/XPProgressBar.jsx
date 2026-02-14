import React, { useState, useEffect, useRef } from 'react';
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
  const [displayedLevel, setDisplayedLevel] = useState(getLevelFromXp(initialXP));
  const { nextLevel, xpProgress, xpNeeded, progressPercent } = useLevelProgress(displayedXP);
  const [showXPPopup, setShowXPPopup] = useState(false);
  const [displayedProgress, setDisplayedProgress] = useState(progressPercent);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isLevelingUp, setIsLevelingUp] = useState(false);
  const [shakingBar, setShakingBar] = useState(false);
  const animationRef = useRef(null);
  const levelUpCallbackRef = useRef(onLevelUp);
  
  // Keep callback ref up to date
  useEffect(() => {
    levelUpCallbackRef.current = onLevelUp;
  }, [onLevelUp]);

  // Animation du popup "+X XP"
  useEffect(() => {
    if (recentXPGain > 0 && animate) {
      setShowXPPopup(true);
      const timer = setTimeout(() => setShowXPPopup(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [recentXPGain, animate]);

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

  // Multi-level animation: animate from startXP to currentXP with level-up effects
  useEffect(() => {
    if (startXP == null || !animate) {
      setDisplayedXP(currentXP);
      setDisplayedLevel(getLevelFromXp(currentXP));
      return;
    }

    if (currentXP === startXP) return;

    // Cancel any existing animation
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }

    const startLevel = getLevelFromXp(startXP);
    const endLevel = getLevelFromXp(currentXP);
    const levelsToGain = endLevel - startLevel;
    
    // Simple animation if no level ups
    if (levelsToGain <= 0) {
      let isRunning = true;
      const duration = 1200;
      const startTime = performance.now();
      
      const step = (now) => {
        if (!isRunning) return;
        const t = Math.min(1, (now - startTime) / duration);
        const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
        const nextXP = Math.round(startXP + (currentXP - startXP) * eased);
        setDisplayedXP(nextXP);
        
        if (t < 1) {
          animationRef.current = requestAnimationFrame(step);
        }
      };
      
      animationRef.current = requestAnimationFrame(step);
      return () => {
        isRunning = false;
        if (animationRef.current) cancelAnimationFrame(animationRef.current);
      };
    }

    // Multi-level animation with pauses at each level-up
    let isRunning = true;
    let currentAnimXP = startXP;
    let currentAnimLevel = startLevel;

    const animateToLevel = (targetXP, callback) => {
      const from = currentAnimXP;
      const duration = 800;
      const startTime = performance.now();
      
      const step = (now) => {
        if (!isRunning) return;
        const t = Math.min(1, (now - startTime) / duration);
        const eased = 1 - Math.pow(1 - t, 3);
        const nextXP = Math.round(from + (targetXP - from) * eased);
        setDisplayedXP(nextXP);
        currentAnimXP = nextXP;
        
        if (t < 1) {
          animationRef.current = requestAnimationFrame(step);
        } else {
          callback?.();
        }
      };
      
      animationRef.current = requestAnimationFrame(step);
    };

    const processNextLevel = () => {
      if (!isRunning) return;
      
      if (currentAnimLevel < endLevel) {
        // Animate to next level threshold
        const nextLevelXP = getXpForLevel(currentAnimLevel + 1);
        
        animateToLevel(nextLevelXP, () => {
          if (!isRunning) return;
          
          // Trigger level-up effects
          currentAnimLevel++;
          setDisplayedLevel(currentAnimLevel);
          setIsLevelingUp(true);
          setShakingBar(true);
          
          // Notify parent of level-up
          if (levelUpCallbackRef.current) {
            levelUpCallbackRef.current(currentAnimLevel);
          }
          
          // Shake for 500ms, then continue
          setTimeout(() => {
            if (!isRunning) return;
            setShakingBar(false);
            setIsLevelingUp(false);
            
            // Brief pause before continuing
            setTimeout(() => {
              if (!isRunning) return;
              processNextLevel();
            }, 200);
          }, 500);
        });
      } else {
        // Animate remaining XP within final level
        animateToLevel(currentXP, () => {
          // Animation complete
        });
      }
    };

    // Start the animation chain
    processNextLevel();

    return () => {
      isRunning = false;
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [startXP, currentXP, animate]);

  const isCompact = size === 'compact';

  return (
    <div className={`xp-progress-container ${isCompact ? 'xp-progress-compact' : ''} ${isLevelingUp ? 'level-up-active' : ''}`}>
      {/* Header avec niveau et XP */}
      {showDetailed && (
        <div className="xp-progress-header">
          <div className={`xp-level-badge ${isLevelingUp ? 'leveling-up' : ''}`}>
            <span className="xp-level-label">Niveau</span>
            <span className="xp-level-value">{displayedLevel}</span>
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
        <div className={`xp-progress-bar-track ${shakingBar ? 'shaking' : ''}`}>
          <div 
            className={`xp-progress-bar-fill ${isAnimating ? 'animating' : ''} ${isLevelingUp ? 'level-up-glow' : ''}`}
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
  startXP: PropTypes.number,
  recentXPGain: PropTypes.number,
  showDetailed: PropTypes.bool,
  animate: PropTypes.bool,
  size: PropTypes.oneOf(['default', 'compact']),
  onLevelUp: PropTypes.func,
};

export default XPProgressBar;
