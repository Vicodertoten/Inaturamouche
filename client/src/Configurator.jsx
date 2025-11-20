import React, { useMemo, useId } from 'react';
import CustomFilter from './CustomFilter';
import ErrorModal from './components/ErrorModal';
import './configurator.css';
import { useGame } from './context/GameContext';
import { useLanguage } from './context/LanguageContext.jsx';
import { usePacks } from './context/PacksContext.jsx';

function Configurator({ onStartGame }) {
  const {
    activePackId,
    setActivePackId,
    customFilters,
    dispatchCustomFilters,
    error,
    clearError,
    gameMode,
    setGameMode,
  } = useGame();
  const { packs, loading: packsLoading, error: packsError } = usePacks();
  const { t, useScientificName, setUseScientificName } = useLanguage();
  const preferenceHintId = useId();

  const activePack = useMemo(() => packs.find((pack) => pack.id === activePackId), [packs, activePackId]);

  const recommendedPack = useMemo(() => {
    const eligible = packs.filter((pack) => pack.id !== 'custom');
    if (!eligible.length) return null;
    const today = new Date().toISOString().slice(0, 10);
    const hash = today.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return eligible[hash % eligible.length];
  }, [packs]);

  const scientificPreferenceHint = t('common.scientific_preference_help');

  // On trouve les détails du pack actuellement sélectionné pour afficher sa description

  // Le gestionnaire pour le changement de sélection dans le menu déroulant
  const handlePackChange = (e) => {
    setActivePackId(e.target.value);
  };

  const handleModeChange = (mode) => {
    setGameMode(mode);
  };

  return (
    <>
      <div className="configurator-panel">
        {(error || packsError) && (
          <ErrorModal message={error || packsError} onClose={error ? clearError : undefined} />
        )}

        <section className="config-section">
          <div className="section-head">
            <span className="step-badge">1</span>
            <div>
              <p className="eyebrow">{t('configurator.pack_label')}</p>
              <p className="section-subtitle">{t('configurator.pack_hint')}</p>
            </div>
          </div>

          {recommendedPack && (
            <div className="recommended-pack">
              <div>
                <p className="eyebrow">{t('home.recommended_pack_label')}</p>
                <h3>{recommendedPack.titleKey ? t(recommendedPack.titleKey) : recommendedPack.id}</h3>
              </div>
              <button
                type="button"
                className="secondary-button"
                onClick={() => setActivePackId(recommendedPack.id)}
                disabled={packsLoading || recommendedPack.id === activePackId}
              >
                {recommendedPack.id === activePackId
                  ? t('home.recommended_pack_active')
                  : t('home.recommended_pack_cta')}
              </button>
            </div>
          )}

          <div className="pack-card">
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
                  disabled={packsLoading}
                >
                  {packs.map((pack) => (
                    <option key={pack.id} value={pack.id}>
                      {pack.titleKey ? t(pack.titleKey) : pack.id}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="pack-details">
              {packsLoading && (
                <p className="pack-description">{t('configurator.loading_packs') ?? 'Chargement des packs...'}</p>
              )}
              {activePack?.descriptionKey && !packsLoading && (
                <p className="pack-description">
                   {t(activePack.descriptionKey)}
                </p>
              )}
              {activePackId === 'custom' && (
                <div className="advanced-filters open">
                  <CustomFilter
                    filters={customFilters}
                    dispatch={dispatchCustomFilters}
                  />
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="config-section">
          <div className="section-head">
            <span className="step-badge">2</span>
            <div>
              <p className="eyebrow">{t('home.play_pillar_title')}</p>
              <p className="section-subtitle">{t('home.play_pillar_desc')}</p>
            </div>
          </div>

          <div className="mode-cards" role="radiogroup" aria-label={t('home.play_pillar_title')}>
            <label className={`mode-card ${gameMode === 'easy' ? 'selected' : ''}`}>
              <input
                type="radio"
                name="mode"
                value="easy"
                checked={gameMode === 'easy'}
                onChange={() => handleModeChange('easy')}
              />
              <div className="mode-visual grid-icon" aria-hidden="true">
                <span></span><span></span><span></span><span></span>
              </div>
              <div className="mode-content">
                <h4>{t('home.easy_mode')}</h4>
                <p className="mode-description">{t('home.easy_mode_description')}</p>
              </div>
            </label>

            <label className={`mode-card ${gameMode === 'hard' ? 'selected' : ''}`}>
              <input
                type="radio"
                name="mode"
                value="hard"
                checked={gameMode === 'hard'}
                onChange={() => handleModeChange('hard')}
              />
              <div className="mode-visual tree-icon" aria-hidden="true">
                <span className="trunk"></span>
                <span className="branch left"></span>
                <span className="branch right"></span>
              </div>
              <div className="mode-content">
                <h4>{t('home.hard_mode')}</h4>
                <p className="mode-description">{t('home.hard_mode_description')}</p>
              </div>
            </label>
          </div>

          <div className="options-row">
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
          </div>
        </section>

        <div className="config-footer">
          <div className="section-head">
            <span className="step-badge">3</span>
            <div>
              <p className="eyebrow">{t('common.start_game')}</p>
              <p className="section-subtitle">{t('home.play_pillar_desc')}</p>
            </div>
          </div>
          <button onClick={onStartGame} className="start-button" disabled={packsLoading}>
            {t('common.start_game')}
          </button>
        </div>
      </div>
    </>
  );
}

export default Configurator;
