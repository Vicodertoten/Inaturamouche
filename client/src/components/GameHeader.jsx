import React from 'react';
import StreakBadge from './StreakBadge';
import { useLanguage } from '../context/LanguageContext.jsx';
import './GameHeader.css';

/**
 * Composant de header réutilisable pour les modes de jeu.
 * Affiche les statistiques du jeu (score, question, vies/indice) et les actions disponibles.
 * Supporte les modes "hard" et "easy".
 *
 * @param {Object} props
 * @param {string} props.mode - 'hard' ou 'easy'
 * @param {number} props.score - Score actuel du joueur
 * @param {number} props.currentStreak - Streak actuel du joueur
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
  score,
  currentStreak,
  questionCount,
  maxQuestions,
  guesses,
  onQuit,
  isGameOver = false,
  onHint,
  hintDisabled = false,
}) => {
  const { t } = useLanguage();
  const hasQuestionLimit = Number.isInteger(maxQuestions) && maxQuestions > 0;

  const questionValue = hasQuestionLimit ? `${questionCount}/${maxQuestions}` : questionCount;
  const showLives = mode === 'hard';

  return (
    <header className={`game-header ${mode}-mode-header`}>
      <div className="header-stats">
        <div className="stat-pill score-pill">
          <span className="pill-label">{t('hard.stats.score', {}, 'Score')}</span>
          <span className="pill-value">{score}</span>
        </div>
        <div className="stat-pill">
          <span className="pill-label">{t('hard.stats.question', {}, 'Question')}</span>
          <span className="pill-value">{questionValue}</span>
        </div>
        {showLives && (
          <div className={`stat-pill lives-pill ${guesses <= 1 ? 'critical' : ''}`}>
            <span className="pill-label">{t('hard.stats.guesses', {}, 'Vies')}</span>
            <span className="pill-value">{guesses}</span>
          </div>
        )}
        <div className="streak-chip">
          <StreakBadge streak={currentStreak} />
        </div>
      </div>
      <div className="header-actions">
        {mode === 'easy' && (
          <button
            className="action-button hint-button-easy"
            onClick={onHint}
            disabled={hintDisabled}
            type="button"
          >
            {t('easy.hint_button', { cost: 5 })}
          </button>
        )}
        <button onClick={onQuit} disabled={isGameOver} className="action-button quit" type="button">
          {t('common.finish')}
        </button>
      </div>
    </header>
  );
};

export default GameHeader;
