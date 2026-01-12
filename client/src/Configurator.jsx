import React, { useCallback, useMemo } from 'react';
import CustomFilter from './CustomFilter';
import ErrorModal from './components/ErrorModal';
import './configurator.css';
import { useGameData, useGameUI } from './context/GameContext';
import { useLanguage } from './context/LanguageContext.jsx';
import { usePacks } from './context/PacksContext.jsx';
import { useUser } from './context/UserContext.jsx';

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

const usePackOptions = ({ packs, t, canStartReview, missedCount }) =>
  useMemo(() => {
    const baseOptions = [
      {
        id: 'review',
        label: `${t('common.review_mistakes')}${missedCount ? ` (${missedCount})` : ''}`,
        disabled: !canStartReview,
      },
      ...packs.map((pack) => ({
        id: pack.id,
        label: pack.titleKey ? t(pack.titleKey) : pack.id,
      })),
    ];

    return baseOptions;
  }, [packs, t, canStartReview, missedCount]);

function Configurator({ onStartGame }) {
  const {
    activePackId,
    setActivePackId,
    customFilters,
    dispatchCustomFilters,
    gameMode,
    setGameMode,
    canStartReview,
    maxQuestions,
    setMaxQuestions,
    mediaType,
    setMediaType,
  } = useGameData();
  const { error, clearError } = useGameUI();
  const { packs, loading: packsLoading, error: packsError } = usePacks();
  const { profile } = useUser();
  const { t } = useLanguage();
  const missedCount = profile?.stats?.missedSpecies?.length || 0;

  const packOptions = usePackOptions({ packs, t, canStartReview, missedCount });

  const activePack = useMemo(() => {
    if (activePackId === 'review') {
      return { id: 'review', descriptionKey: 'home.learn_action_review' };
    }
    return packs.find((pack) => pack.id === activePackId);
  }, [activePackId, packs]);

  const isReviewSelection = activePackId === 'review';
  const selectedQuestionValue =
    Number.isInteger(maxQuestions) && maxQuestions > 0 ? String(maxQuestions) : 'infinite';
  const showSoundsNotice = mediaType === 'sounds' || mediaType === 'both';

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

  const handlePackChange = useCallback(
    (e) => {
      setActivePackId(e.target.value);
    },
    [setActivePackId]
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
      onStartGame({ review: isReviewSelection, maxQuestions, mediaType });
    }
  }, [isReviewSelection, maxQuestions, mediaType, onStartGame]);

  const packDescription =
    activePack?.descriptionKey && !packsLoading ? t(activePack.descriptionKey) : null;

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
            <div className="pack-selector">
              <label htmlFor="pack-select">{t('configurator.pack_label')}</label>
              <div
                className="tooltip"
                data-tooltip={t('configurator.pack_hint')}
                onPointerLeave={(e) => e.currentTarget.querySelector('select')?.blur()}
                title={t('configurator.pack_hint')}
              >
                <select
                  id="pack-select"
                  value={activePackId}
                  onChange={handlePackChange}
                  className="pack-select-dropdown"
                  disabled={packsLoading}
                >
                  {packOptions.map((option) => (
                    <option key={option.id} value={option.id} disabled={option.disabled}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="pack-details">
              {packsLoading && (
                <>
                  <SkeletonLine width="74%" />
                  <SkeletonLine width="54%" />
                </>
              )}
              {!packsLoading && packDescription && (
                <p className="pack-description">
                  {packDescription}
                </p>
              )}
              {isReviewSelection && !canStartReview && (
                <p className="pack-description muted">{t('home.learn_action_review_disabled')}</p>
              )}
              {activePackId === 'custom' && (
                <div className="advanced-filters open">
                  <CustomFilter filters={customFilters} dispatch={dispatchCustomFilters} />
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="config-section">
          <SectionHeader
            step="2"
            title={t('home.play_pillar_title')}
            subtitle={t('home.play_pillar_desc')}
          />

          <div className="mode-cards" role="radiogroup" aria-label={t('home.play_pillar_title')}>
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

          <div className="game-settings-grid">
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
        
          <button
            onClick={handleStartClick}
            className="start-button start-button-glow"
            disabled={packsLoading || (isReviewSelection && !canStartReview)}
            aria-label={t('common.start_game')}
          >
            {t('common.start_game')}
          </button>
        </div>
      
    </>
  );
}

export default Configurator;
