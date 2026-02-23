import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import CustomFilter from './components/CustomFilter';
import ErrorModal from '../../components/ErrorModal';
import PackIcon from '../../components/PackIcons';
import './Configurator.css';
import { useGameData, useGameUI } from '../../context/GameContext';
import { useLanguage } from '../../context/LanguageContext.jsx';
import { usePacks } from '../../context/PacksContext.jsx';
import { getPackEducationalWarningKey } from '../../utils/packWarnings';

const ModeVisual = ({ variant }) => {
  const gradientId = useMemo(
    () => `configurator-phylo-${Math.random().toString(36).slice(2, 10)}`,
    []
  );
  if (variant === 'easy') {
    return (
      <div className="mode-visual mode-visual-easy" aria-hidden="true">
        <div className="soft-grid">
          <span className="tile tile-1" />
          <span className="tile tile-2" />
          <span className="tile tile-3" />
          <span className="tile tile-4" />
        </div>
        <div className="grid-glow" />
      </div>
    );
  }
  const gradientUrl = `url(#${gradientId})`;
  return (
    <div className="mode-visual mode-visual-hard" aria-hidden="true">
      <svg className="phylo-icon" viewBox="0 0 120 120" role="presentation" focusable="false">
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--primary-color, #606c38)" stopOpacity="0.9" />
            <stop offset="100%" stopColor="var(--accent-color, #dda15e)" stopOpacity="0.9" />
          </linearGradient>
        </defs>
        <g stroke={gradientUrl} strokeWidth="3" fill="none" strokeLinecap="round">
          <path d="M60 100 V70" />
          <path d="M60 70 C60 60, 50 55, 42 50" />
          <path d="M60 70 C60 60, 72 55, 80 48" />
          <path d="M42 50 C32 42, 26 34, 20 26" />
          <path d="M42 50 C46 40, 54 34, 60 26" />
          <path d="M80 48 C90 38, 96 32, 102 22" />
          <path d="M80 48 C76 36, 68 30, 60 26" />
        </g>
        <g className="phylo-nodes" fill={gradientUrl}>
          <circle cx="60" cy="100" r="6" className="node root" />
          <circle cx="60" cy="70" r="5" />
          <circle cx="42" cy="50" r="4" />
          <circle cx="80" cy="48" r="4" />
          <circle cx="20" cy="26" r="4" />
          <circle cx="60" cy="26" r="4" />
          <circle cx="102" cy="22" r="4" />
        </g>
      </svg>
      <div className="phylo-aura" />
    </div>
  );
};

const EyeIcon = () => (
  <svg className="media-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path
      d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="12" cy="12" r="3.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
  </svg>
);

const SoundIcon = () => (
  <svg className="media-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path
      d="M4 10h4l5-4v12l-5-4H4z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
    />
    <path
      d="M16 9a4 4 0 010 6"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
    />
    <path
      d="M18.5 6.5a7 7 0 010 11"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
    />
  </svg>
);

const BothIcon = () => (
  <span className="media-icon-stack" aria-hidden="true">
    <EyeIcon />
    <SoundIcon />
  </span>
);

const SectionHeader = ({ step, title, subtitle }) => (
  <div className="section-head">
    <span className="step-badge">{step}</span>
    <div>
      <p className="eyebrow">{title}</p>
      {subtitle && <p className="section-subtitle">{subtitle}</p>}
    </div>
  </div>
);

const SkeletonLine = ({ width = '100%' }) => (
  <div className="skeleton-line" style={{ width }} aria-hidden="true"></div>
);

const usePackOptions = ({ packs, t }) =>
  useMemo(() => {
    return packs.map((pack) => ({
      id: pack.id,
      label: pack.titleKey ? t(pack.titleKey) : pack.id,
    }));
  }, [packs, t]);

function Configurator({ onStartGame }) {
  const {
    activePackId,
    setActivePackId,
    customFilters,
    dispatchCustomFilters,
    gameMode,
    setGameMode,
    maxQuestions,
    setMaxQuestions,
    mediaType,
    setMediaType,
  } = useGameData();
  const { error, clearError } = useGameUI();
  const {
    packs,
    loading: packsLoading,
    error: packsError,
    homeSections,
    homeLoading,
    refreshHomeCatalog,
    regionOverride,
    setRegionOverride,
    effectiveRegion,
    detectedRegion,
  } = usePacks();
  const { t } = useLanguage();

  const packOptions = usePackOptions({ packs, t });
  const [packView, setPackView] = useState('packs');
  const isCatalogLoading = packsLoading || homeLoading;

  useEffect(() => {
    void refreshHomeCatalog({ region: effectiveRegion, regionOverride });
  }, [effectiveRegion, regionOverride, refreshHomeCatalog]);

  const activePack = useMemo(
    () => packs.find((pack) => pack.id === activePackId),
    [activePackId, packs]
  );
  const selectedQuestionValue =
    Number.isInteger(maxQuestions) && maxQuestions > 0 ? String(maxQuestions) : 'infinite';
  const showSoundsNotice = mediaType === 'sounds' || mediaType === 'both';

  useEffect(() => {
    if (gameMode !== 'easy' && gameMode !== 'hard') {
      setGameMode('easy');
    }
  }, [gameMode, setGameMode]);

  const questionOptions = useMemo(
    () => [
      { value: 5, label: '5' },
      { value: 10, label: '10' },
      { value: 20, label: '20' },
      { value: 50, label: '50' },
      { value: 'infinite', label: t('configurator.option_infinite') },
    ],
    [t]
  );

  const mediaOptions = useMemo(
    () => [
      { value: 'images', label: t('configurator.option_images'), Icon: EyeIcon },
      { value: 'sounds', label: t('configurator.option_sounds'), Icon: SoundIcon },
      { value: 'both', label: t('configurator.option_both'), Icon: BothIcon },
    ],
    [t]
  );

  const prefabPacks = useMemo(
    () => packOptions.filter((pack) => pack.id !== 'custom'),
    [packOptions]
  );
  const packById = useMemo(
    () => new Map(packs.map((pack) => [pack.id, pack])),
    [packs]
  );
  const packOptionById = useMemo(
    () => new Map(packOptions.map((option) => [option.id, option])),
    [packOptions]
  );
  const orderedPackSections = useMemo(() => {
    if (isCatalogLoading) return [];

    const sectionsFromHome = (Array.isArray(homeSections) ? homeSections : [])
      .map((section) => {
        const rawPacks = Array.isArray(section?.packs) ? section.packs : [];
        const sectionPacks = rawPacks
          .map((item) => {
            const packId = typeof item === 'string' ? item : item?.id;
            if (!packId || packId === 'custom') return null;
            const basePack = packById.get(packId);
            if (!basePack) return null;
            return {
              ...basePack,
              label: packOptionById.get(packId)?.label || (basePack.titleKey ? t(basePack.titleKey) : packId),
            };
          })
          .filter(Boolean);

        return {
          id: String(section?.id || 'catalog'),
          label: section?.titleKey ? t(section.titleKey, {}, section.id) : t('home.section_catalog', {}, 'Catalogue'),
          packs: sectionPacks,
        };
      })
      .filter((section) => section.packs.length > 0);

    const homeSectionPackIds = new Set(
      sectionsFromHome.flatMap((section) => section.packs.map((pack) => pack.id))
    );
    const remainingPacks = packs
      .filter((pack) => pack.id !== 'custom' && !homeSectionPackIds.has(pack.id))
      .sort((a, b) => {
        const weightDelta = (a.sortWeight ?? 9999) - (b.sortWeight ?? 9999);
        if (weightDelta !== 0) return weightDelta;
        return String(a.id).localeCompare(String(b.id));
      })
      .map((pack) => ({
        ...pack,
        label: packOptionById.get(pack.id)?.label || (pack.titleKey ? t(pack.titleKey) : pack.id),
      }));

    if (remainingPacks.length > 0) {
      sectionsFromHome.push({
        id: 'catalog',
        label: t('home.section_catalog', {}, 'Catalogue'),
        packs: remainingPacks,
      });
    }

    return sectionsFromHome;
  }, [isCatalogLoading, homeSections, packById, packOptionById, packs, t]);

  /* ── Hover description with delay ── */
  const hoverTimerRef = useRef(null);
  const [hoveredPackId, setHoveredPackId] = useState(null);
  const handleTileMouseEnter = useCallback((packId) => {
    hoverTimerRef.current = setTimeout(() => setHoveredPackId(packId), 400);
  }, []);
  const handleTileMouseLeave = useCallback(() => {
    clearTimeout(hoverTimerRef.current);
    setHoveredPackId(null);
  }, []);

  const hoveredPack = useMemo(() => {
    if (!hoveredPackId) return null;
    return packs.find((p) => p.id === hoveredPackId) || null;
  }, [hoveredPackId, packs]);

  const handlePackSelect = useCallback(
    (packId) => {
      setActivePackId(packId);
    },
    [setActivePackId]
  );

  const handlePackViewChange = useCallback(
    (nextView) => {
      setPackView(nextView);
      if (nextView === 'custom') {
        setActivePackId('custom');
        return;
      }
      if (activePackId === 'custom' && prefabPacks.length > 0) {
        setActivePackId(prefabPacks[0].id);
      }
    },
    [activePackId, prefabPacks, setActivePackId]
  );

  const handleModeChange = useCallback(
    (mode) => {
      setGameMode(mode);
    },
    [setGameMode]
  );

  const handleQuestionLimitChange = useCallback(
    (value) => {
      if (value === 'infinite') {
        setMaxQuestions(null);
        return;
      }
      const parsed = Number(value);
      setMaxQuestions(Number.isFinite(parsed) ? parsed : null);
    },
    [setMaxQuestions]
  );

  const handleMediaTypeChange = useCallback(
    (value) => {
      setMediaType(value);
    },
    [setMediaType]
  );

  const handleStartClick = useCallback(() => {
    if (typeof onStartGame === 'function') {
      onStartGame({ maxQuestions, mediaType });
    }
  }, [maxQuestions, mediaType, onStartGame]);

  const handleRegionOverrideChange = useCallback((event) => {
    const value = String(event.target.value || '').trim().toLowerCase();
    const nextOverride = value === 'auto' ? null : value;
    const nextRegion = nextOverride || detectedRegion || 'world';
    setRegionOverride(nextOverride);
    void refreshHomeCatalog({ region: nextRegion, regionOverride: nextOverride });
  }, [detectedRegion, refreshHomeCatalog, setRegionOverride]);

  const packDescription =
    activePack?.descriptionKey && !isCatalogLoading ? t(activePack.descriptionKey) : null;
  const activePackWarningKey =
    !isCatalogLoading ? getPackEducationalWarningKey(activePack) : null;
  const hoveredPackWarningKey = hoveredPack
    ? getPackEducationalWarningKey(hoveredPack)
    : null;
  const isPackView = packView === 'packs';
  const isCustomView = packView === 'custom';

  return (
    <>
      <div className="configurator-panel">
        {(error || packsError) && (
          <ErrorModal message={error || packsError} onClose={error ? clearError : undefined} />
        )}

        <section className="config-section">
          <SectionHeader
            step="1"
            title={t('configurator.pack_label')}
            subtitle={t('configurator.pack_hint')}
          />

          <div className="pack-card pack-card-glow">
            <div className="pack-submenu" role="tablist" aria-label="Choix du pack">
              <button
                type="button"
                className={`pack-submenu-button ${isPackView ? 'active' : ''}`}
                onClick={() => handlePackViewChange('packs')}
                aria-pressed={isPackView}
              >
                Packs
              </button>
              <button
                type="button"
                className={`pack-submenu-button ${isCustomView ? 'active' : ''}`}
                onClick={() => handlePackViewChange('custom')}
                aria-pressed={isCustomView}
              >
                Personnalisé
              </button>
            </div>
            <div className="pack-region-override">
              <label htmlFor="config-region-override">
                {t('home.region_override_label', {}, 'Région des packs')}
              </label>
              <select
                id="config-region-override"
                className="pack-select-dropdown"
                value={regionOverride || 'auto'}
                onChange={handleRegionOverrideChange}
              >
                <option value="auto">{t('home.region_override_auto', {}, 'Auto')}</option>
                <option value="belgium">{t('packs._regions.belgium', {}, 'Belgique')}</option>
                <option value="europe">{t('packs._regions.europe', {}, 'Europe')}</option>
                <option value="world">{t('packs._regions.world', {}, 'Monde')}</option>
              </select>
            </div>

            {isPackView && (
              <>
                <div className="pack-catalog" data-test="pack-selector">
                  {isCatalogLoading &&
                    <div className="pack-scroll-row">
                      {Array.from({ length: 4 }, (_, index) => (
                        <div className="pack-chip pack-chip--skeleton" key={`skeleton-${index}`}>
                          <SkeletonLine width="60%" />
                        </div>
                      ))}
                    </div>
                  }
                  {!isCatalogLoading &&
                    orderedPackSections.map(({ id, label, packs: sectionPacks }) => (
                      <div className="pack-region-group" key={id}>
                        <p className="pack-region-label">{label}</p>
                        <div className="pack-scroll-row" role="list">
                          {sectionPacks.map((option) => {
                            const isSelected = activePackId === option.id;
                            return (
                              <button
                                key={option.id}
                                type="button"
                                className={`pack-chip${isSelected ? ' pack-chip--active' : ''}`}
                                onClick={() => handlePackSelect(option.id)}
                                onMouseEnter={() => handleTileMouseEnter(option.id)}
                                onMouseLeave={handleTileMouseLeave}
                                aria-pressed={isSelected}
                                role="listitem"
                              >
                                <PackIcon packId={option.id} className="pack-chip__icon" />
                                <span className="pack-chip__label">{option.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}

                  {/* description bar on hover */}
                  {hoveredPack && (
                    <div className="pack-desc-bar">
                      <PackIcon packId={hoveredPack.id} className="pack-desc-bar__icon" />
                      <span className="pack-desc-bar__text">
                        <span>{hoveredPack.descriptionKey ? t(hoveredPack.descriptionKey) : hoveredPack.label}</span>
                        {hoveredPackWarningKey && (
                          <span className="pack-desc-bar__warning">{t(hoveredPackWarningKey)}</span>
                        )}
                      </span>
                    </div>
                  )}
                  {activePackWarningKey && (
                    <p className="pack-safety-warning">{t(activePackWarningKey)}</p>
                  )}
                </div>
              </>
            )}

            {isCustomView && (
              <div className="pack-details">
                {packsLoading && (
                  <>
                    <SkeletonLine width="74%" />
                    <SkeletonLine width="54%" />
                  </>
                )}
                {!packsLoading && packDescription && activePackId === 'custom' && (
                  <p className="pack-description">{packDescription}</p>
                )}
                <div className="advanced-filters open">
                  <CustomFilter filters={customFilters} dispatch={dispatchCustomFilters} />
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="config-section">
          <SectionHeader
            step="2"
            title={t('home.play_pillar_title')}
            subtitle={t('home.play_pillar_desc')}
          />

          <div 
            className="mode-cards tutorial-mode-cards" 
            role="radiogroup" 
            aria-label={t('home.play_pillar_title')}
            data-test="mode-selector"
          >
            <label className={`mode-card ${gameMode === 'easy' ? 'selected' : ''}`}>
              <input
                type="radio"
                name="mode"
                value="easy"
                checked={gameMode === 'easy'}
                onChange={() => handleModeChange('easy')}
                aria-label={t('home.easy_mode')}
              />
              <ModeVisual variant="easy" />
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
                aria-label={t('home.hard_mode')}
              />
              <ModeVisual variant="hard" />
              <div className="mode-content">
                <h4>{t('home.hard_mode')}</h4>
                <p className="mode-description">{t('home.hard_mode_description')}</p>
              </div>
            </label>
          </div>
        </section>

        <section className="config-section">
          <SectionHeader
            step="3"
            title={t('configurator.game_settings_title')}
            subtitle={t('configurator.game_settings_hint')}
          />

          <div className="game-settings-grid tutorial-game-settings">
            <div className="setting-card">
              <p className="setting-label">{t('configurator.question_count_label')}</p>
              <div
                className="setting-options"
                role="radiogroup"
                aria-label={t('configurator.question_count_label')}
              >
                {questionOptions.map((option) => {
                  const valueString = String(option.value);
                  const isActive = selectedQuestionValue === valueString;
                  return (
                    <label
                      key={valueString}
                      className={`setting-option ${isActive ? 'active' : ''}`}
                    >
                      <input
                        type="radio"
                        name="question-count"
                        value={valueString}
                        checked={isActive}
                        onChange={() => handleQuestionLimitChange(valueString)}
                        aria-label={option.label}
                      />
                      <span className="option-label">{option.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="setting-card">
              <p className="setting-label">{t('configurator.media_type_label')}</p>
              <div
                className="setting-options media-options"
                role="radiogroup"
                aria-label={t('configurator.media_type_label')}
              >
                {mediaOptions.map(({ value, label, Icon }) => {
                  const isActive = mediaType === value;
                  return (
                    <label
                      key={value}
                      className={`setting-option media-option ${isActive ? 'active' : ''}`}
                    >
                      <input
                        type="radio"
                        name="media-type"
                        value={value}
                        checked={isActive}
                        onChange={() => handleMediaTypeChange(value)}
                        aria-label={label}
                      />
                      <span className="option-icon" aria-hidden="true">
                        {React.createElement(Icon)}
                      </span>
                      <span className="option-label">{label}</span>
                    </label>
                  );
                })}
              </div>
              {showSoundsNotice && (
                <p className="settings-hint">{t('configurator.sounds_warning')}</p>
              )}
            </div>
          </div>
        </section>
        
        <div className="play-button-container">
          <button
            onClick={handleStartClick}
            className="btn btn--primary start-button start-button-glow play-btn tutorial-start-game"
            disabled={packsLoading}
            aria-label={t('common.start_game')}
          >
            {t('common.start_game')}
          </button>
        </div>
      </div>
    </>
  );
}

export default Configurator;
