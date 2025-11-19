import React, { useMemo, useId } from 'react';
import PACKS from '../../shared/packs.js';
import CustomFilter from './CustomFilter';
import ErrorModal from './components/ErrorModal';
import './configurator.css';
import { useGame } from './context/GameContext';
import { useLanguage } from './context/LanguageContext.jsx';

function Configurator({ onStartGame, onStartReview, onShowHelp }) {
  const {
    activePackId,
    setActivePackId,
    customFilters,
    dispatchCustomFilters,
    error,
    clearError,
    canStartReview,
  } = useGame();
  const { t, useScientificName, setUseScientificName } = useLanguage();
  const preferenceHintId = useId();

  const activePack = useMemo(() => PACKS.find((pack) => pack.id === activePackId), [activePackId]);
  const scientificPreferenceHint = t('common.scientific_preference_help');

  // On trouve les détails du pack actuellement sélectionné pour afficher sa description

  // Le gestionnaire pour le changement de sélection dans le menu déroulant
  const handlePackChange = (e) => {
    setActivePackId(e.target.value);
  };

  return (
    <>
      {onShowHelp && (
        <button
          type="button"
          className="help-button config-help-button"
          onClick={onShowHelp}
          aria-label={t('nav.help_label')}
          title={t('nav.help_label')}
        >
          ?
        </button>
      )}

      <div className="configurator-panel">
        {error && <ErrorModal message={error} onClose={clearError} />}
        
        <div className="pack-selector">
          <label htmlFor="pack-select">{t('configurator.pack_label')}</label>
          <div
            className="tooltip"
            data-tooltip={t('configurator.pack_hint')}
            onPointerLeave={e => e.currentTarget.querySelector('select')?.blur()}
            title={t('configurator.pack_hint')}
          >
            <select
              id="pack-select"
              value={activePackId}
              onChange={handlePackChange}
              className="pack-select-dropdown"
            >
              {PACKS.map((pack) => (
                <option key={pack.id} value={pack.id}>
                  {pack.titleKey ? t(pack.titleKey) : pack.id}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="pack-details">
          {activePack?.descriptionKey && (
            <p className="pack-description">
              <strong>{t('common.pack_description_label')}:</strong> {t(activePack.descriptionKey)}
            </p>
          )}
          {/* Si le pack "Personnalisé" est actif, on affiche son interface de filtres */}
          {activePackId === 'custom' && (
            <CustomFilter 
              filters={customFilters}
              dispatch={dispatchCustomFilters}
            />
          )}
        </div>

        <div className="scientific-toggle">
          <label
            className="checkbox-label preference-toggle tooltip"
            data-tooltip={scientificPreferenceHint}
            title={scientificPreferenceHint}
          >
            <input
              type="checkbox"
              checked={useScientificName}
              onChange={(e) => setUseScientificName(e.target.checked)}
              aria-describedby={preferenceHintId}
            />
            <span className="custom-checkbox" aria-hidden="true"></span>
            <span className="checkbox-text">{t('common.scientific_preference_label')}</span>
            <span id={preferenceHintId} className="sr-only preference-hint">
              {scientificPreferenceHint}
            </span>
          </label>
        </div>

        <button onClick={onStartGame} className="start-button">{t('common.start_game')}</button>
        {canStartReview && (
          <button onClick={onStartReview} className="start-button">{t('common.review_mistakes')}</button>
        )}
      </div>
    </>
  );
}

export default Configurator;
