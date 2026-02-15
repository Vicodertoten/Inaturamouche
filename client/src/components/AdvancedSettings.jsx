import React, { useCallback, useMemo, useState } from 'react';
import { useGameData } from '../context/GameContext';
import { useLanguage } from '../context/LanguageContext.jsx';
import './AdvancedSettings.css';

/* ── tiny SVG icons (kept from Configurator) ── */
const EyeIcon = () => (
  <svg className="media-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="12" cy="12" r="3.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
  </svg>
);
const SoundIcon = () => (
  <svg className="media-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M4 10h4l5-4v12l-5-4H4z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    <path d="M16 9a4 4 0 010 6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    <path d="M18.5 6.5a7 7 0 010 11" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);
const BothIcon = () => (
  <span className="media-icon-stack" aria-hidden="true"><EyeIcon /><SoundIcon /></span>
);

/**
 * Collapsible "Advanced settings" accordion.
 * Contains: game mode, question count, media type, lab modes, custom filter.
 */
export default function AdvancedSettings() {
  const {
    gameMode, setGameMode,
    maxQuestions, setMaxQuestions,
    mediaType, setMediaType,
  } = useGameData();
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);

  const isRiddleMode = gameMode === 'riddle';
  const selectedQuestionValue = Number.isInteger(maxQuestions) && maxQuestions > 0 ? String(maxQuestions) : 'infinite';
  const showSoundsNotice = !isRiddleMode && (mediaType === 'sounds' || mediaType === 'both');

  const questionOptions = useMemo(() => [
    { value: 5, label: '5' },
    { value: 10, label: '10' },
    { value: 20, label: '20' },
    { value: 50, label: '50' },
    { value: 'infinite', label: t('configurator.option_infinite') },
  ], [t]);

  const mediaOptions = useMemo(() => [
    { value: 'images', label: t('configurator.option_images'), Icon: EyeIcon },
    { value: 'sounds', label: t('configurator.option_sounds'), Icon: SoundIcon },
    { value: 'both', label: t('configurator.option_both'), Icon: BothIcon },
  ], [t]);

  const handleLabMode = useCallback((mode) => {
    setGameMode(mode);
    if (mode === 'riddle') setMediaType('images');
  }, [setGameMode, setMediaType]);

  const handleQuestionLimitChange = useCallback((value) => {
    if (value === 'infinite') { setMaxQuestions(null); return; }
    const parsed = Number(value);
    setMaxQuestions(Number.isFinite(parsed) ? parsed : null);
  }, [setMaxQuestions]);

  const handleMediaTypeChange = useCallback((value) => {
    setMediaType(value);
  }, [setMediaType]);

  // Summary line (shown when collapsed)
  const qLabel = maxQuestions ? `${maxQuestions}Q` : '∞';
  const mediaLabel = mediaType === 'sounds' ? '🔊' : mediaType === 'both' ? '📷+🔊' : '📷';

  return (
    <section className="advanced-settings tutorial-advanced-settings">
      <button
        type="button"
        className={`advanced-toggle ${open ? 'open' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="advanced-toggle-icon" aria-hidden="true">⚙️</span>
        <span className="advanced-toggle-label">
          {t('home.advanced_settings', {}, 'Paramètres avancés')}
        </span>
        <span className="advanced-toggle-summary">
          {qLabel} · {mediaLabel}
        </span>
        <span className={`advanced-chevron ${open ? 'rotated' : ''}`} aria-hidden="true">▾</span>
      </button>

      {open && (
        <div className="advanced-body">
          {/* ── Question count ── */}
          <div className="adv-group">
            <p className="adv-label">{t('configurator.question_count_label')}</p>
            <div className="adv-option-row" role="radiogroup" aria-label={t('configurator.question_count_label')}>
              {questionOptions.map((opt) => {
                const vs = String(opt.value);
                const isActive = selectedQuestionValue === vs;
                return (
                  <label key={vs} className={`adv-option ${isActive ? 'active' : ''}`}>
                    <input type="radio" name="adv-q" value={vs} checked={isActive} onChange={() => handleQuestionLimitChange(vs)} />
                    <span>{opt.label}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* ── Media type ── */}
          <div className="adv-group">
            <p className="adv-label">{t('configurator.media_type_label')}</p>
            <div className="adv-option-row" role="radiogroup" aria-label={t('configurator.media_type_label')}>
              {mediaOptions.map(({ value, label, Icon }) => {
                const isActive = mediaType === value;
                return (
                  <label key={value} className={`adv-option ${isActive ? 'active' : ''} ${isRiddleMode ? 'disabled' : ''}`}>
                    <input type="radio" name="adv-media" value={value} checked={isActive} onChange={() => handleMediaTypeChange(value)} disabled={isRiddleMode} />
                    <span className="option-icon" aria-hidden="true">{React.createElement(Icon)}</span>
                    <span>{label}</span>
                  </label>
                );
              })}
            </div>
            {isRiddleMode && <p className="adv-hint">{t('configurator.riddle_media_hint')}</p>}
            {showSoundsNotice && <p className="adv-hint">{t('configurator.sounds_warning')}</p>}
          </div>

          {/* ── Lab modes ── */}
          <div className="adv-group adv-lab">
            <p className="adv-label">🧪 {t('home.lab_modes', {}, 'Modes labo')}</p>
            <div className="adv-mode-row">
              <label className={`adv-mode-chip lab ${gameMode === 'riddle' ? 'active' : ''}`}>
                <input type="radio" name="adv-lab" value="riddle" checked={gameMode === 'riddle'} onChange={() => handleLabMode('riddle')} />
                {t('home.riddle_mode')}
              </label>
              <label className={`adv-mode-chip lab ${gameMode === 'taxonomic' ? 'active' : ''}`}>
                <input type="radio" name="adv-lab" value="taxonomic" checked={gameMode === 'taxonomic'} onChange={() => handleLabMode('taxonomic')} />
                {t('home.taxonomic_mode')} <span className="beta-tag">β</span>
              </label>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
