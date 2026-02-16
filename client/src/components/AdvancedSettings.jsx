import React, { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { useGameData } from '../context/GameContext';
import { useLanguage } from '../context/LanguageContext.jsx';
import { SettingsIcon } from './NavigationIcons';
import './AdvancedSettings.css';

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
  const selectedQuestionValue = Number.isInteger(maxQuestions) && maxQuestions > 0 ? String(maxQuestions) : 'infinite';
  const scientificModeEnabled = nameFormat === 'scientific';
  const modeGroupName = useId();
  const mediaGroupName = useId();
  const questionGroupName = useId();

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

  const setQuestionChoice = useCallback((value) => {
    setMaxQuestions(Number.isInteger(value) ? value : null);
  }, [setMaxQuestions]);

  const qLabel = Number.isInteger(maxQuestions) && maxQuestions > 0 ? `${maxQuestions}Q` : '∞';
  const MediaSummaryIcon = effectiveMediaType === 'sounds' ? SoundIcon : EyeIcon;
  const modeLabel = currentMode === 'easy'
    ? t('home.easy_mode', {}, 'Facile')
    : t('home.hard_mode', {}, 'Difficile');
  const settingsLabel = t('home.settings_label', {}, 'Paramètres');

  return (
    <section className={`advanced-settings tutorial-advanced-settings ${showToggle ? 'show-toggle' : 'no-toggle'} ${className}`.trim()}>
      {showToggle && (
        <button
          type="button"
          className={`advanced-toggle ${open ? 'open' : ''}`}
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          <SettingsIcon className="advanced-toggle-icon" />
          <span className="advanced-toggle-label">
            {settingsLabel}
          </span>
          <span className="advanced-toggle-summary">
            <span>{modeLabel} · {qLabel}</span>
            <span className="advanced-toggle-summary-media" aria-hidden="true">
              {React.createElement(MediaSummaryIcon)}
            </span>
          </span>
          <span className={`advanced-chevron ${open ? 'rotated' : ''}`} aria-hidden="true">▾</span>
        </button>
      )}

      {open && (
        <div className="advanced-body adv-layout">
          <p className="adv-context">
            {t('home.settings_helper', {}, 'Ajuste la partie avant de lancer.')}
          </p>

          <div className="adv-top-grid">
            <div className="adv-group">
              <p className="adv-label">{t('home.play_pillar_title', {}, 'Mode')}</p>
              <div className={`adv-slide-switch ${currentMode === 'hard' ? 'hard' : 'easy'}`} role="radiogroup" aria-label={t('home.play_pillar_title', {}, 'Mode')}>
                <span className="adv-slide-thumb" aria-hidden="true" />
                <label className={`adv-slide-option ${currentMode === 'easy' ? 'active' : ''}`}>
                  <input
                    type="radio"
                    name={`${modeGroupName}-mode`}
                    value="easy"
                    checked={currentMode === 'easy'}
                    onChange={() => setGameMode('easy')}
                  />
                  <span className="adv-slide-option-label">{t('home.easy_mode', {}, 'Facile')}</span>
                </label>
                <label className={`adv-slide-option ${currentMode === 'hard' ? 'active' : ''}`}>
                  <input
                    type="radio"
                    name={`${modeGroupName}-mode`}
                    value="hard"
                    checked={currentMode === 'hard'}
                    onChange={() => setGameMode('hard')}
                  />
                  <span className="adv-slide-option-label">{t('home.hard_mode', {}, 'Difficile')}</span>
                </label>
              </div>
            </div>

            <div className="adv-group">
              <p className="adv-label">{t('configurator.media_type_label')}</p>
              <div className={`adv-slide-switch ${effectiveMediaType === 'sounds' ? 'hard' : 'easy'}`} role="radiogroup" aria-label={t('configurator.media_type_label')}>
                <span className="adv-slide-thumb" aria-hidden="true" />
                <label className={`adv-slide-option ${effectiveMediaType === 'images' ? 'active' : ''}`}>
                  <input
                    type="radio"
                    name={`${mediaGroupName}-media`}
                    value="images"
                    checked={effectiveMediaType === 'images'}
                    onChange={() => setMediaType('images')}
                  />
                  <span className="adv-slide-option-label">
                    <EyeIcon />
                    {t('configurator.option_images')}
                  </span>
                </label>
                <label className={`adv-slide-option ${effectiveMediaType === 'sounds' ? 'active' : ''}`}>
                  <input
                    type="radio"
                    name={`${mediaGroupName}-media`}
                    value="sounds"
                    checked={effectiveMediaType === 'sounds'}
                    onChange={() => setMediaType('sounds')}
                  />
                  <span className="adv-slide-option-label">
                    <SoundIcon />
                    {t('configurator.option_sounds')}
                  </span>
                </label>
              </div>
            </div>
          </div>

          <div className="adv-group adv-group-questions">
            <p className="adv-label">{t('configurator.question_count_label')}</p>
            <div className="adv-pill-group" role="radiogroup" aria-label={t('configurator.question_count_label')}>
              {questionOptions.map((option) => {
                const valueString = Number.isInteger(option.value) ? String(option.value) : 'infinite';
                const isActive = selectedQuestionValue === valueString;
                return (
                  <label key={valueString} className={`adv-pill-option ${isActive ? 'active' : ''}`}>
                    <input
                      type="radio"
                      name={`${questionGroupName}-questions`}
                      value={valueString}
                      checked={isActive}
                      onChange={() => setQuestionChoice(option.value)}
                    />
                    <span>{option.label}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="adv-group adv-group-inline">
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
