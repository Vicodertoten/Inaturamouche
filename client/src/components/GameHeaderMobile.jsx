import React from 'react';
import { useLanguage } from '../context/LanguageContext.jsx';
import './GameHeaderMobile.css';

/**
 * Ultra-minimal mobile header for game modes
 * Displays only essential information: Question counter, Lives, Streak, Quit button
 * XP/Level/Multipliers are hidden during gameplay to reduce visual clutter
 * 
 * @param {Object} props
 * @param {string} props.mode - 'hard' ou 'easy'
 * @param {number} props.questionCount - Current question number
 * @param {number} [props.maxQuestions] - Total questions (optional)
 * @param {number} [props.guesses] - Remaining lives (hard mode only)
 * @param {number} props.currentStreak - Current streak value
 * @param {Function} props.onQuit - Callback for quit button
 */
const GameHeaderMobile = ({ mode, questionCount, maxQuestions, guesses, currentStreak, onQuit }) => {
  const { t } = useLanguage();
  const hasLimit = Number.isInteger(maxQuestions) && maxQuestions > 0;
  const showLives = mode === 'hard';
  
  // Format question counter
  const questionDisplay = hasLimit ? `${questionCount}/${maxQuestions}` : questionCount;
  
  // Generate heart icons for lives (hard mode)
  const renderHearts = () => {
    if (!showLives || !guesses) return null;
    
    const maxHearts = 3; // Standard max lives
    const hearts = [];
    
    for (let i = 0; i < maxHearts; i++) {
      hearts.push(
        <span 
          key={i} 
          className={`heart ${i < guesses ? 'filled' : 'empty'}`}
          aria-hidden="true"
        >
          {i < guesses ? '❤️' : '○'}
        </span>
      );
    }
    
    return hearts;
  };
  
  return (
    <header className="game-header-mobile" role="banner">
      <div className="mobile-header-content">
        {/* Left: Question counter */}
        <div 
          className="mobile-question-counter"
          role="status"
          aria-label={t('hard.aria.question_counter', { current: questionCount, total: maxQuestions }, `Question ${questionDisplay}`)}
        >
          {questionDisplay}
        </div>
        
        {/* Center: Streak and Lives */}
        <div className="mobile-center-group">
          {/* Streak display */}
          <div 
            className="mobile-streak"
            role="status"
            aria-label={t('streak.current', { count: currentStreak }, `Streak: ${currentStreak}`)}
          >
            <span className="streak-flame" role="img" aria-hidden="true">🔥</span>
            <span className="streak-number">{currentStreak}</span>
          </div>
          
          {/* Lives (hard mode only) */}
          {showLives && (
            <div 
              className={`mobile-lives ${guesses <= 1 ? 'critical' : ''}`}
              role="status"
              aria-label={t('hard.aria.lives_remaining', { count: guesses }, `${guesses} lives remaining`)}
              aria-live="polite"
            >
              {renderHearts()}
            </div>
          )}
        </div>
        
        {/* Right: Quit button */}
        <button 
          className="mobile-quit-button"
          onClick={onQuit}
          type="button"
          aria-label={t('common.finish', {}, 'Quit game')}
        >
          ×
        </button>
      </div>
    </header>
  );
};

export default GameHeaderMobile;
