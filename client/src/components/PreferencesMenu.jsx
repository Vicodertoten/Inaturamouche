import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLanguage } from '../context/LanguageContext.jsx';
import './PreferencesMenu.css';

const LANGUAGE_OPTIONS = [
  { code: 'fr', label: 'FR' },
  { code: 'nl', label: 'NL' },
  { code: 'en', label: 'EN' },
];

function GearIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="preferences-gear-icon">
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6Zm8.5 3c0-.47-.04-.93-.12-1.38l-1.7-.28a7 7 0 0 0-.81-1.78l1.02-1.36a8.5 8.5 0 0 0-1.98-1.98l-1.36 1.02a7 7 0 0 0-1.78-.81l-.28-1.7A8.5 8.5 0 0 0 12 2.5c-.47 0-.93.04-1.38.12l-.28 1.7a7 7 0 0 0-1.78.81L7.2 4.11a8.5 8.5 0 0 0-1.98 1.98l1.02 1.36c-.36.56-.63 1.16-.81 1.78l-1.7.28A8.5 8.5 0 0 0 3.5 12c0 .47.04.93.12 1.38l1.7.28c.18.62.45 1.22.81 1.78L5.1 16.8a8.5 8.5 0 0 0 1.98 1.98l1.36-1.02c.56.36 1.16.63 1.78.81l.28 1.7c.45.08.91.12 1.38.12.47 0 .93-.04 1.38-.12l.28-1.7c.62-.18 1.22-.45 1.78-.81l1.36 1.02a8.5 8.5 0 0 0 1.98-1.98l-1.02-1.36c.36-.56.63-1.16.81-1.78l1.7-.28c.08-.45.12-.91.12-1.38Z"
      />
    </svg>
  );
}

function LeafIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path
        fill="currentColor"
        d="M20.4 3.24a1 1 0 0 0-.93-.28c-3.46.74-10.63 2.22-14.1 5.7a8 8 0 0 0 0 11.32 5.06 5.06 0 0 0 3.68 1.62 5.1 5.1 0 0 0 2.74-.8l5.37-3.39a1 1 0 0 0-1.06-1.7l-3.17 2a6.1 6.1 0 0 1-2.31 1 6 6 0 0 1 .4-6.05c2.15-2.76 7-4.05 10.65-4.72a1 1 0 0 0 .73-.5 1 1 0 0 0 0-1.2Z"
      />
    </svg>
  );
}

function FlaskIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path
        fill="currentColor"
        d="M9 2h6a1 1 0 0 1 1 1v1.35a2 2 0 0 1-.26 1L14.5 7.7v2.42l3.48 6.17A2.8 2.8 0 0 1 15.48 21H8.52a2.8 2.8 0 0 1-2.5-4.7L9.5 10.1V7.7L8.26 5.35a2 2 0 0 1-.26-1V3a1 1 0 0 1 1-1Zm5 2H10v0.76l1.24 2.27c.17.32.26.67.26 1.03v1.64c0 .37-.09.74-.28 1.06l-2.92 5.18a.8.8 0 0 0 .7 1.19h6.96a.8.8 0 0 0 .7-1.2l-2.92-5.17a2.2 2.2 0 0 1-.28-1.06V8.06c0-.36.09-.71.26-1.03L14 4.76Z"
      />
    </svg>
  );
}

const NAME_FORMAT_OPTIONS = [
  { value: 'vernacular', Icon: LeafIcon, labelKey: 'common.common_name_option' },
  { value: 'scientific', Icon: FlaskIcon, labelKey: 'common.scientific_name_option' },
];

function PreferencesMenu({ isOpen: externalIsOpen, onToggle: externalOnToggle, isMobileControlled = false }) {
  const { language, setLanguage, nameFormat, toggleNameFormat, t } = useLanguage();
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const menuRef = useRef(null);

  // Use external state if provided, otherwise use internal state
  const isOpen = externalIsOpen !== undefined ? externalIsOpen : internalIsOpen;
  const setIsOpen = externalOnToggle !== undefined
    ? externalOnToggle
    : setInternalIsOpen;

  const preferencesTitle = useMemo(
    () => t('common.preferences_title', {}, 'Settings'),
    [t]
  );
  const languageTitle = useMemo(
    () => t('common.preferences_language', {}, t('common.language_switcher_label')),
    [t]
  );
  const displayTitle = useMemo(
    () => t('common.preferences_display', {}, t('common.name_display_label')),
    [t]
  );

  const closeMenu = useCallback(() => {
    if (externalOnToggle !== undefined) {
      // If controlled externally, close by calling onToggle if currently open
      if (externalIsOpen) externalOnToggle();
    } else {
      setInternalIsOpen(false);
    }
  }, [externalIsOpen, externalOnToggle]);
  
  const toggleMenu = useCallback(() => {
    if (externalOnToggle !== undefined) {
      externalOnToggle();
    } else {
      setInternalIsOpen((open) => !open);
    }
  }, [externalOnToggle]);

  useEffect(() => {
    if (!isOpen) return undefined;
    
    // Don't auto-close when mobile-controlled (button is external)
    if (isMobileControlled) return undefined;

    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        closeMenu();
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') closeMenu();
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [closeMenu, isOpen, isMobileControlled]);

  // Mobile-specific: close on clicking backdrop (but keep ESC key)
  useEffect(() => {
    if (!isOpen || !isMobileControlled) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') closeMenu();
    };

    const handleBackdropClick = (event) => {
      // Don't close if clicking on the settings button in bottom nav
      const settingsButton = event.target.closest('.bottom-nav-item');
      if (settingsButton) return;
      
      // Close if clicking outside the popover itself
      const popover = menuRef.current?.querySelector('.preferences-popover');
      if (popover && !popover.contains(event.target)) {
        closeMenu();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleBackdropClick);
    document.addEventListener('touchstart', handleBackdropClick);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleBackdropClick);
      document.removeEventListener('touchstart', handleBackdropClick);
    };
  }, [closeMenu, isOpen, isMobileControlled]);

  const handleLanguageChange = useCallback(
    (code) => {
      if (code === language) return;
      setLanguage(code);
    },
    [language, setLanguage]
  );

  const handleNameFormatChange = useCallback(
    (format) => {
      if (format === nameFormat) return;
      toggleNameFormat(format);
    },
    [nameFormat, toggleNameFormat]
  );

  return (
    <div className="preferences-menu" ref={menuRef}>
      {!isMobileControlled && (
        <button
          type="button"
          className="preferences-trigger nav-pill nav-icon nav-elevated"
          aria-haspopup="menu"
          aria-expanded={isOpen}
          aria-label={t('common.preferences_menu_label', {}, 'Open preferences')}
          title={t('common.preferences_menu_label', {}, 'Open preferences')}
          onClick={toggleMenu}
        >
          <GearIcon />
        </button>
      )}

      {isOpen && (
        <div className="preferences-popover" role="menu" aria-label={preferencesTitle}>
          <div className="preferences-header">
            <span className="preferences-title">{preferencesTitle}</span>
          </div>

          <div className="preferences-section" role="group" aria-label={languageTitle}>
            <p className="preferences-section-title">{languageTitle}</p>
            <div className="preferences-language-options">
              {LANGUAGE_OPTIONS.map(({ code, label }) => {
                const isActive = language === code;
                return (
                  <button
                    key={code}
                    type="button"
                    className={`language-chip ${isActive ? 'active' : ''}`}
                    onClick={() => handleLanguageChange(code)}
                    aria-pressed={isActive}
                    title={t('common.language_switcher_label')}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="preferences-section" role="group" aria-label={displayTitle}>
            <p className="preferences-section-title">{displayTitle}</p>
            <div className="preferences-format-toggle">
              {NAME_FORMAT_OPTIONS.map(({ value, Icon, labelKey }) => {
                const isActive = nameFormat === value;
                return (
                  <button
                    key={value}
                    type="button"
                    className={`format-option ${isActive ? 'active' : ''}`}
                    onClick={() => handleNameFormatChange(value)}
                    aria-pressed={isActive}
                  >
                    <span className="format-icon" aria-hidden="true">
                      {React.createElement(Icon)}
                    </span>
                    <span className="format-label">{t(labelKey)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PreferencesMenu;
