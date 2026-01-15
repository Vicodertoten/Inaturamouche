import React from 'react';
import InGameStreakDisplay from './InGameStreakDisplay';
import XPProgressBar from './XPProgressBar';
import ActiveMultipliers from './ActiveMultipliers';
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
}) => {
  const { t } = useLanguage();
  const { profile } = useUser();
  const { recentXPGain, xpMultipliers } = useGameData();
  const { level } = useLevelProgress(profile?.xp || 0);
  const hasQuestionLimit = Number.isInteger(maxQuestions) && maxQuestions > 0;

  const questionValue = hasQuestionLimit ? `${questionCount}/${maxQuestions}` : questionCount;
  const showLives = mode === 'hard';

  return (
    <header className={`game-header ${mode}-mode-header`}>
      {/* Section XP avec niveau */}
      <div className="header-xp-section">
        <div className="xp-level-display">
          <span className="xp-level-label">Niv. {level}</span>
          <span className="xp-amount">{(profile?.xp || 0).toLocaleString()} XP</span>
        </div>
        <XPProgressBar 
          currentXP={profile?.xp || 0}
          recentXPGain={recentXPGain}
          showDetailed={false}
          animate={true}
          size="compact"
        />
        <ActiveMultipliers 
          dailyStreakBonus={xpMultipliers?.dailyStreakBonus || 0}
          perksMultiplier={xpMultipliers?.perksMultiplier || 1.0}
          winStreakBonus={xpMultipliers?.winStreakBonus || 0}
          timerBonus={xpMultipliers?.timerBonus || 0}
        />
      </div>

      <div className="header-stats">
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
