import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLanguage } from '../context/LanguageContext.jsx';
import './PreferencesMenu.css';
import { LanguageIcon } from './NavigationIcons';

const LANGUAGE_OPTIONS = [
  { code: 'fr', label: 'FR' },
  { code: 'nl', label: 'NL' },
  { code: 'en', label: 'EN' },
];

function PreferencesMenu({ isOpen: externalIsOpen, onToggle: externalOnToggle, isMobileControlled = false }) {
  const { language, setLanguage, t } = useLanguage();
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const menuRef = useRef(null);

  const isOpen = externalIsOpen !== undefined ? externalIsOpen : internalIsOpen;

  const preferencesTitle = useMemo(
    () => t('common.preferences_language', {}, t('common.language_switcher_label')),
    [t]
  );

  const closeMenu = useCallback(() => {
    if (externalOnToggle !== undefined) {
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

  useEffect(() => {
    if (!isOpen || !isMobileControlled) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') closeMenu();
    };

    const handleBackdropClick = (event) => {
      const settingsButton = event.target.closest('.bottom-nav-item');
      if (settingsButton) return;

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

  return (
    <div className="preferences-menu" ref={menuRef}>
      {!isMobileControlled && (
        <button
          type="button"
          className="preferences-trigger nav-pill nav-icon nav-elevated tutorial-nav-settings"
          aria-haspopup="menu"
          aria-expanded={isOpen}
          aria-label={t('common.language_switcher_label', {}, 'Changer de langue')}
          title={t('common.language_switcher_label', {}, 'Changer de langue')}
          onClick={toggleMenu}
        >
          <LanguageIcon className="preferences-language-icon" />
        </button>
      )}

      {isOpen && (
        <div className="preferences-popover" role="menu" aria-label={preferencesTitle}>
          <div className="preferences-header">
            <span className="preferences-title">{preferencesTitle}</span>
          </div>

          <div className="preferences-section" role="group" aria-label={preferencesTitle}>
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
        </div>
      )}
    </div>
  );
}

export default PreferencesMenu;
