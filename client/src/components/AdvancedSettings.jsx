import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useGameData } from '../context/GameContext';
import { useLanguage } from '../context/LanguageContext.jsx';
import './AdvancedSettings.css';

const QUESTION_STOPS = [5, 10, 20, 50, null];

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

const resolveQuestionIndex = (maxQuestions) => {
  if (!Number.isInteger(maxQuestions) || maxQuestions <= 0) {
    return QUESTION_STOPS.length - 1;
  }
  const exactMatch = QUESTION_STOPS.findIndex((value) => value === maxQuestions);
  if (exactMatch >= 0) return exactMatch;
  let closestIndex = 0;
  let closestDiff = Number.POSITIVE_INFINITY;
  QUESTION_STOPS.forEach((value, index) => {
    if (!Number.isInteger(value)) return;
    const diff = Math.abs(maxQuestions - value);
    if (diff < closestDiff) {
      closestDiff = diff;
      closestIndex = index;
    }
  });
  return closestIndex;
};

export default function AdvancedSettings({
  open: openProp,
  onOpenChange,
  showToggle = true,
  className = '',
}) {
  const {
    gameMode, setGameMode,
    maxQuestions, setMaxQuestions,
    mediaType, setMediaType,
  } = useGameData();
  const { t, nameFormat, toggleNameFormat } = useLanguage();
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = typeof openProp === 'boolean';
  const open = isControlled ? openProp : internalOpen;

  const setOpen = useCallback((nextValue) => {
    const resolved = typeof nextValue === 'function' ? nextValue(open) : nextValue;
    if (!isControlled) {
      setInternalOpen(resolved);
    }
    if (onOpenChange) {
      onOpenChange(resolved);
    }
  }, [isControlled, onOpenChange, open]);

  const currentMode = gameMode === 'easy' ? 'easy' : 'hard';
  const effectiveMediaType = mediaType === 'sounds' ? 'sounds' : 'images';
  const questionIndex = resolveQuestionIndex(maxQuestions);
  const scientificModeEnabled = nameFormat === 'scientific';

  useEffect(() => {
    if (mediaType === 'both') {
      setMediaType('images');
    }
  }, [mediaType, setMediaType]);

  const questionOptions = useMemo(() => ([
    { value: 5, label: '5' },
    { value: 10, label: '10' },
    { value: 20, label: '20' },
    { value: 50, label: '50' },
    { value: null, label: t('configurator.option_infinite') },
  ]), [t]);

  const setQuestionIndex = useCallback((index) => {
    const parsedIndex = Number(index);
    const bounded = Math.max(0, Math.min(QUESTION_STOPS.length - 1, parsedIndex));
    const target = QUESTION_STOPS[bounded];
    setMaxQuestions(Number.isInteger(target) ? target : null);
  }, [setMaxQuestions]);

  const qLabel = Number.isInteger(maxQuestions) && maxQuestions > 0 ? `${maxQuestions}Q` : '∞';
  const mediaLabel = effectiveMediaType === 'sounds' ? '🔊' : '📷';
  const modeLabel = currentMode === 'easy'
    ? t('home.easy_mode', {}, 'Facile')
    : t('home.hard_mode', {}, 'Difficile');

  return (
    <section className={`advanced-settings tutorial-advanced-settings ${showToggle ? 'show-toggle' : 'no-toggle'} ${className}`.trim()}>
      {showToggle && (
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
            {modeLabel} · {qLabel} · {mediaLabel}
          </span>
          <span className={`advanced-chevron ${open ? 'rotated' : ''}`} aria-hidden="true">▾</span>
        </button>
      )}

      {open && (
        <div className="advanced-body">
          <div className="adv-group">
            <p className="adv-label">{t('home.play_pillar_title', {}, 'Mode')}</p>
            <div className={`adv-slide-switch ${currentMode === 'hard' ? 'hard' : 'easy'}`} role="radiogroup" aria-label={t('home.play_pillar_title', {}, 'Mode')}>
              <span className="adv-slide-thumb" aria-hidden="true" />
              <button
                type="button"
                className={`adv-slide-option ${currentMode === 'easy' ? 'active' : ''}`}
                onClick={() => setGameMode('easy')}
                aria-pressed={currentMode === 'easy'}
              >
                {t('home.easy_mode', {}, 'Facile')}
              </button>
              <button
                type="button"
                className={`adv-slide-option ${currentMode === 'hard' ? 'active' : ''}`}
                onClick={() => setGameMode('hard')}
                aria-pressed={currentMode === 'hard'}
              >
                {t('home.hard_mode', {}, 'Difficile')}
              </button>
            </div>
          </div>

          <div className="adv-group">
            <p className="adv-label">{t('configurator.media_type_label')}</p>
            <div className={`adv-slide-switch ${effectiveMediaType === 'sounds' ? 'hard' : 'easy'}`} role="radiogroup" aria-label={t('configurator.media_type_label')}>
              <span className="adv-slide-thumb" aria-hidden="true" />
              <button
                type="button"
                className={`adv-slide-option ${effectiveMediaType === 'images' ? 'active' : ''}`}
                onClick={() => setMediaType('images')}
                aria-pressed={effectiveMediaType === 'images'}
              >
                <EyeIcon />
                {t('configurator.option_images')}
              </button>
              <button
                type="button"
                className={`adv-slide-option ${effectiveMediaType === 'sounds' ? 'active' : ''}`}
                onClick={() => setMediaType('sounds')}
                aria-pressed={effectiveMediaType === 'sounds'}
              >
                <SoundIcon />
                {t('configurator.option_sounds')}
              </button>
            </div>
          </div>

          <div className="adv-group">
            <p className="adv-label">{t('configurator.question_count_label')}</p>
            <div className="adv-range-wrap">
              <input
                type="range"
                className="adv-range"
                min="0"
                max={String(questionOptions.length - 1)}
                step="1"
                value={String(questionIndex)}
                onChange={(event) => setQuestionIndex(event.target.value)}
                aria-label={t('configurator.question_count_label')}
              />
              <div className="adv-range-marks">
                {questionOptions.map((option, index) => {
                  const isActive = index === questionIndex;
                  return (
                    <button
                      key={`${option.label}-${index}`}
                      type="button"
                      className={`adv-range-mark ${isActive ? 'active' : ''}`}
                      onClick={() => setQuestionIndex(index)}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="adv-group">
            <label className={`adv-scientific-toggle ${scientificModeEnabled ? 'active' : ''}`}>
              <input
                type="checkbox"
                checked={scientificModeEnabled}
                onChange={(event) => toggleNameFormat(event.target.checked ? 'scientific' : 'vernacular')}
              />
              <span className="adv-scientific-box" aria-hidden="true" />
              <span className="adv-scientific-text">
                {t('common.scientific_preference_label', {}, 'Prioriser le nom scientifique')}
              </span>
              <span className="adv-scientific-badge">XP x2</span>
            </label>
          </div>
        </div>
      )}
    </section>
  );
}
