import React, { useRef, useState, useEffect } from 'react';
import GameHeaderMobile from './GameHeaderMobile';
import { useLanguage } from '../context/LanguageContext.jsx';
import { useUser } from '../context/UserContext';
import { useLevelProgress } from '../hooks/useLevelProgress';
import './GameHeader.css';

/**
 * Minimal game header — shows question counter, streak, and quit button.
 * Delegates to GameHeaderMobile on small screens.
 *
 * XP, level, multipliers, hints, shields are no longer shown during gameplay;
 * they are displayed on the EndPage summary instead.
 *
 * @param {Object} props
 * @param {string} props.mode - 'hard', 'easy', 'riddle', etc.
 * @param {number} props.currentStreak - Current win-streak
 * @param {number} props.questionCount - Current question number
 * @param {number} [props.maxQuestions] - Total questions (optional)
 * @param {number} [props.guesses] - Remaining lives (hard mode only)
 * @param {Function} [props.onQuit] - Quit callback
 * @param {boolean} [props.isGameOver] - Whether game is over
 */
const GameHeader = ({
  mode = 'hard',
  currentStreak,
  questionCount,
  maxQuestions,
  guesses,
  onQuit,
  isGameOver = false,
}) => {
  const { t } = useLanguage();
  const { profile } = useUser();
  const { level, progressPercent, xpProgress, xpNeeded } = useLevelProgress(profile?.xp || 0);
  const hasQuestionLimit = Number.isInteger(maxQuestions) && maxQuestions > 0;
  const questionValue = hasQuestionLimit ? `${questionCount}/${maxQuestions}` : questionCount;
  const showLives = mode === 'hard';

  // Detect XP changes and trigger a brief glow animation
  const prevXpRef = useRef(profile?.xp || 0);
  const [xpGain, setXpGain] = useState(false);

  useEffect(() => {
    const currentXp = profile?.xp || 0;
    if (currentXp > prevXpRef.current) {
      setXpGain(true);
      const timer = setTimeout(() => setXpGain(false), 800);
      prevXpRef.current = currentXp;
      return () => clearTimeout(timer);
    }
    prevXpRef.current = currentXp;
  }, [profile?.xp]);

  return (
    <>
      {/* Mobile Header */}
      <GameHeaderMobile
        mode={mode}
        questionCount={questionCount}
        maxQuestions={maxQuestions}
        guesses={guesses}
        currentStreak={currentStreak}
        onQuit={onQuit}
      />

      {/* Desktop Header — minimal: question + streak + quit */}
      <header className={`game-header ${mode}-mode-header`}>
        <div className="header-row">
          <div className="header-stats">
            <div
              className="stat-pill question-pill"
              role="status"
              aria-label={t('hard.aria.question_counter', { current: questionCount, total: maxQuestions }, `Question ${questionValue}`)}
            >
              <span className="pill-label">{t('hard.stats.question', {}, 'Question')}</span>
              <span className="pill-value">{questionValue}</span>
            </div>

            {showLives && (
              <div
                className={`stat-pill lives-pill ${guesses <= 1 ? 'critical' : ''}`}
                role="status"
                aria-label={t('hard.aria.lives_remaining', { count: guesses }, `${guesses} tentatives restantes`)}
                aria-live="polite"
              >
                <span className="pill-label">{t('hard.stats.guesses', {}, 'Vies')}</span>
                <span className="pill-value">{guesses}</span>
              </div>
            )}

            <div className="streak-chip" role="status" aria-label={t('streak.current', { count: currentStreak }, `Streak: ${currentStreak}`)}>
              <span className="streak-flame" aria-hidden="true">🔥</span>
              <span className="streak-number">{currentStreak}</span>
            </div>

            <div className="xp-chip" role="status" aria-label={`Niveau ${level}`} title={`${xpProgress} / ${xpNeeded} XP`}>
              <span className="xp-chip-level">Nv.{level}</span>
              <div className="xp-chip-bar">
                <div className={`xp-chip-fill${xpGain ? ' xp-gain' : ''}`} style={{ width: `${progressPercent}%` }} />
              </div>
            </div>
          </div>

          <button onClick={onQuit} disabled={isGameOver} className="action-button quit" type="button">
            {t('common.finish')}
          </button>
        </div>
      </header>
    </>
  );
};

export default GameHeader;
