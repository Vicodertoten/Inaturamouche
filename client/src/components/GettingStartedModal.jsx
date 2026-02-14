import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext.jsx';
import './GettingStartedModal.css';

const GettingStartedModal = ({ isOpen, onClose, hasChosenMode, hasPickedPack, hasPlayedGame, onStartGame }) => {
  const { t } = useLanguage();
  const navigate = useNavigate();

  if (!isOpen) return null;

  const canStartGame = hasChosenMode && hasPickedPack;

  const handleGoToPack = () => {
    const packSelector = document.querySelector('[data-test="pack-selector"]');
    if (packSelector) {
      packSelector.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const handleGoToMode = () => {
    const modeSelector = document.querySelector('[data-test="mode-selector"]');
    if (modeSelector) {
      modeSelector.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const handleGoPlay = () => {
    if (canStartGame && typeof onStartGame === 'function') {
      onClose();
      onStartGame();
    }
  };

  return (
    <div className="getting-started-modal-overlay">
      <div className="getting-started-modal">
        <button
          type="button"
          className="getting-started-modal-close"
          onClick={onClose}
          aria-label={t('common.close')}
        >
          ✕
        </button>

        <div className="getting-started-modal-header">
          <h2>{t('help_center.getting_started_title', {}, 'Bien démarrer')}</h2>
          <p>{t('help_center.getting_started_subtitle', {}, 'Trois étapes simples')}</p>
        </div>

        <ul className="getting-started-modal-list">
          <li className={hasPickedPack ? 'is-done' : ''}>
            <div className="getting-started-modal-item-content">
              <span className="checkmark" aria-hidden="true">{hasPickedPack ? '✓' : '○'}</span>
              <span>{t('help_center.getting_started_pack', {}, 'Choisir un pack')}</span>
            </div>
            <button
              type="button"
              className="getting-started-modal-item-action"
              onClick={handleGoToPack}
              disabled={hasPickedPack}
              title={t('common.go_to', {}, 'Aller à')}
              aria-label={t('common.go_to', {}, 'Aller à')}
            >
              →
            </button>
          </li>
          <li className={hasChosenMode ? 'is-done' : ''}>
            <div className="getting-started-modal-item-content">
              <span className="checkmark" aria-hidden="true">{hasChosenMode ? '✓' : '○'}</span>
              <span>{t('help_center.getting_started_mode', {}, 'Choisir un mode')}</span>
            </div>
            <button
              type="button"
              className="getting-started-modal-item-action"
              onClick={handleGoToMode}
              disabled={hasChosenMode}
              title={t('common.go_to', {}, 'Aller à')}
              aria-label={t('common.go_to', {}, 'Aller à')}
            >
              →
            </button>
          </li>
          <li className={`${canStartGame ? 'is-done' : ''} ${!canStartGame ? 'is-disabled' : ''}`}>
            <div className="getting-started-modal-item-content">
              <span className="checkmark" aria-hidden="true">{canStartGame ? '✓' : '○'}</span>
              <span>{t('help_center.getting_started_play', {}, 'Lancer une partie')}</span>
            </div>
            <button
              type="button"
              className="getting-started-modal-item-action"
              onClick={handleGoPlay}
              disabled={!canStartGame}
              title={canStartGame ? t('common.go_to', {}, 'Aller à') : t('help_center.complete_setup', {}, 'Complète d\'abord')}
              aria-label={canStartGame ? t('common.go_to', {}, 'Aller à') : t('help_center.complete_setup', {}, 'Complète d\'abord')}
            >
              →
            </button>
          </li>
        </ul>
      </div>
    </div>
  );
};

export default GettingStartedModal;
