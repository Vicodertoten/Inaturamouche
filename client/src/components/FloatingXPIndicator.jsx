import React, { useEffect, useState, useRef } from 'react';
import './FloatingXPIndicator.css';

/**
 * Floating XP indicator that appears when points are gained
 * Similar to the XPProgressBar popup but positioned differently for in-game feedback
 * @param {number} xpGain - Amount of XP gained (0 means hidden)
 * @param {string} position - Position of the indicator ('center', 'top-right', etc.)
 */
const FloatingXPIndicator = ({ xpGain = 0, position = 'center' }) => {
  const [visible, setVisible] = useState(false);
  const [displayValue, setDisplayValue] = useState(0);
  const timerRef = useRef(null);

  useEffect(() => {
    // Cleanup function to clear timer on unmount or xpGain change
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (xpGain > 0) {
      // Clear any existing timer before setting a new one
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      
      setDisplayValue(xpGain);
      setVisible(true);
      
      timerRef.current = setTimeout(() => {
        setVisible(false);
      }, 2000);
    }
  }, [xpGain]);

  if (!visible || displayValue === 0) return null;

  return (
    <div className={`floating-xp-indicator floating-xp-${position}`}>
      <span className="xp-icon">✨</span>
      <span className="xp-value">+{displayValue} XP</span>
    </div>
  );
};

export default FloatingXPIndicator;
