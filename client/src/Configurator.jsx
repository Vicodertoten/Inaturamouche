import React, { useCallback, useMemo } from 'react';
import CustomFilter from './CustomFilter';
import ErrorModal from './components/ErrorModal';
import './configurator.css';
import { useGame } from './context/GameContext';
import { useLanguage } from './context/LanguageContext.jsx';
import { usePacks } from './context/PacksContext.jsx';
import { useUser } from './context/UserContext.jsx';

const ModeVisual = ({ variant }) => {
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
  return (
    <div className="mode-visual mode-visual-hard" aria-hidden="true">
      <svg className="phylo-svg" viewBox="0 0 120 120" role="presentation" focusable="false">
        <defs>
          <linearGradient id="phyloGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--primary-color)" stopOpacity="0.9" />
            <stop offset="100%" stopColor="var(--accent-color)" stopOpacity="0.9" />
          </linearGradient>
        </defs>
        <g stroke="url(#phyloGradient)" strokeWidth="3" fill="none" strokeLinecap="round">
          <path d="M60 100 V70" />
          <path d="M60 70 C60 60, 50 55, 42 50" />
          <path d="M60 70 C60 60, 72 55, 80 48" />
          <path d="M42 50 C32 42, 26 34, 20 26" />
          <path d="M42 50 C46 40, 54 34, 60 26" />
          <path d="M80 48 C90 38, 96 32, 102 22" />
          <path d="M80 48 C76 36, 68 30, 60 26" />
        </g>
        <g className="phylo-nodes" fill="url(#phyloGradient)">
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
    error,
    clearError,
    gameMode,
    setGameMode,
    canStartReview,
  } = useGame();
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

  const recommendedPack = useMemo(() => {
    const eligible = packs.filter((pack) => pack.id !== 'custom');
    if (!eligible.length) return null;
    const today = new Date().toISOString().slice(0, 10);
    const hash = today.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return eligible[hash % eligible.length];
  }, [packs]);

  const isReviewSelection = activePackId === 'review';

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

  const handleStartClick = useCallback(() => {
    if (typeof onStartGame === 'function') {
      onStartGame(isReviewSelection);
    }
  }, [isReviewSelection, onStartGame]);

  const handleUseRecommended = useCallback(() => {
    if (recommendedPack) {
      setActivePackId(recommendedPack.id);
    }
  }, [recommendedPack, setActivePackId]);

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
        <div className="config-start footer-actions">
          <div className="start-copy">
            <p className="start-heading">{t('home.play_pillar_title')}</p>
            <p className="start-subtitle">{t('home.play_pillar_desc')}</p>
          </div>
          <button
            onClick={handleStartClick}
            className="start-button start-button-glow"
            disabled={packsLoading || (isReviewSelection && !canStartReview)}
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
