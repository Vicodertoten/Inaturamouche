import React, { useEffect, useState } from 'react';
import InGameStreakDisplay from './InGameStreakDisplay';
import XPProgressBar from './XPProgressBar';
import ActiveMultipliers from './ActiveMultipliers';
import GameHeaderMobile from './GameHeaderMobile';
import { useLevelProgress } from '../hooks/useLevelProgress';
import { useUser } from '../context/UserContext';
import { useGameData } from '../context/GameContext';
import { useLanguage } from '../context/LanguageContext.jsx';
import './GameHeader.css';

/**
 * Composant de header réutilisable pour les modes de jeu.
 * Affiche les statistiques du jeu (XP, niveau, question, vies/indice) et les actions disponibles.
 * Supporte les modes "hard" et "easy".
 *
 * @param {Object} props
 * @param {string} props.mode - 'hard' ou 'easy'
 * @param {number} props.currentStreak - Streak actuel du joueur
 * @param {number} [props.inGameShields] - Nombre de boucliers disponibles
 * @param {boolean} [props.hasPermanentShield] - Si le bouclier permanent est débloqué
 * @param {number} props.questionCount - Numéro de la question actuelle
 * @param {number} [props.maxQuestions] - Nombre total de questions (optionnel)
 * @param {number} [props.guesses] - Nombre de vies restantes (mode hard uniquement)
 * @param {Function} [props.onQuit] - Callback pour le bouton quitter
 * @param {boolean} [props.isGameOver] - Si le jeu est terminé
 * @param {Function} [props.onHint] - Callback pour le bouton indice (mode easy)
 * @param {boolean} [props.hintDisabled] - Si le bouton indice est désactivé
 * @returns {JSX.Element}
 */
const GameHeader = ({
  mode = 'hard',
  currentStreak,
  inGameShields = 0,
  hasPermanentShield = false,
  questionCount,
  maxQuestions,
  guesses,
  onQuit,
  isGameOver = false,
  onHint,
  hintDisabled = false,
  hintCost = 5,
  userXP = 0,
}) => {
  const { t } = useLanguage();
  const { profile } = useUser();
  const { recentXPGain, xpMultipliers, isReviewMode } = useGameData();
  const { level, xpProgress = 0, xpNeeded = 1 } = useLevelProgress(profile?.xp || 0);
  const hasQuestionLimit = Number.isInteger(maxQuestions) && maxQuestions > 0;

  const questionValue = hasQuestionLimit ? `${questionCount}/${maxQuestions}` : questionCount;
  const showLives = mode === 'hard';

  // Indicateur auto-save
  const [showAutoSave, setShowAutoSave] = useState(false);

  useEffect(() => {
    // Afficher brièvement l'indicateur auto-save toutes les 30 secondes
    const interval = setInterval(() => {
      setShowAutoSave(true);
      setTimeout(() => setShowAutoSave(false), 2000);
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  return (
    <>
      {/* Mobile Header - Shown only on mobile devices */}
      <GameHeaderMobile
        mode={mode}
        questionCount={questionCount}
        maxQuestions={maxQuestions}
        guesses={guesses}
        currentStreak={currentStreak}
        onQuit={onQuit}
      />
      
      {/* Desktop Header - Hidden on mobile */}
      <header className={`game-header ${mode}-mode-header`}>
        {/* Indicateur auto-save */}
        {showAutoSave && (
          <div className="auto-save-indicator" role="status" aria-live="polite">
            <span className="save-icon">💾</span>
            <span className="save-text">{t('common.auto_saved', {}, 'Sauvegardé')}</span>
          </div>
        )}

        {/* Ligne 1: Niveau | Barre XP */}
        <div className="header-row-1">
          <div className="level-xp-container">
            <div className="level-badge">
              <span className="level-label">Niv.</span>
              <span className="level-value">{level}</span>
            </div>
            <div className="xp-bar-wrapper">
              <XPProgressBar 
                currentXP={profile?.xp || 0}
                recentXPGain={recentXPGain}
                showDetailed={false}
                animate={true}
                size="compact"
              />
              
            </div>
          </div>
          <ActiveMultipliers 
            dailyStreakBonus={xpMultipliers?.dailyStreakBonus || 0}
            perksMultiplier={xpMultipliers?.perksMultiplier || 1.0}
            winStreakBonus={xpMultipliers?.winStreakBonus || 0}
            timerBonus={xpMultipliers?.timerBonus || 0}
          />
        </div>

        {/* Ligne 2: Question | Vies | Streak+Shields | Boutons */}
        <div className="header-row-2">
          <div className="header-stats">
            <div className="stat-pill question-pill" role="status" aria-label={t('hard.aria.question_counter', { current: questionCount, total: maxQuestions }, `Question ${questionValue}`)}>
              <span className="pill-label">{t('hard.stats.question', {}, 'Question')}</span>
              <span className="pill-value">{questionValue}</span>
              {isReviewMode && <span className="review-badge">📚 Révision</span>}
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
            <div className="streak-chip">
              <InGameStreakDisplay 
                streak={currentStreak}
                shields={inGameShields}
                hasPermanentShield={hasPermanentShield}
              />
            </div>
          </div>
          <div className="header-actions">
            {mode === 'easy' && (
              <button
                className={`action-button hint-button-easy ${userXP < hintCost ? 'insufficient-xp' : ''}`}
                onClick={onHint}
                disabled={hintDisabled}
                type="button"
                title={userXP < hintCost ? t('hints.not_enough_xp_tooltip', { cost: hintCost, current: userXP }, `XP insuffisant (${userXP}/${hintCost})`) : ''}
              >
                {t('easy.hint_button_xp', { cost: hintCost }, `Indice (-${hintCost} XP)`)}
              </button>
            )}
            <button onClick={onQuit} disabled={isGameOver} className="action-button quit" type="button">
              {t('common.finish')}
            </button>
          </div>
        </div>
      </header>
    </>
  );
};

export default GameHeader;
