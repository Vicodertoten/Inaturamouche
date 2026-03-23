import { describe, it, expect } from 'vitest';
import { detectBrowserLanguage } from '../context/LanguageContext.jsx';

// Helper to temporarily override navigator values
function withNavigator(styles, fn) {
  const original = { ...globalThis.navigator };
  Object.defineProperty(globalThis, 'navigator', {
    value: { ...original, ...styles },
    configurable: true,
    writable: true,
  });
  try {
    fn();
  } finally {
    Object.defineProperty(globalThis, 'navigator', {
      value: original,
      configurable: true,
      writable: true,
    });
  }
}

describe('detectBrowserLanguage', () => {
  it('returns default when navigator undefined', () => {
    const realNav = globalThis.navigator;
    delete globalThis.navigator;
    expect(detectBrowserLanguage()).toBe('fr');
    globalThis.navigator = realNav;
  });

  it('picks language from navigator.language', () => {
    withNavigator({ language: 'nl-NL' }, () => {
      expect(detectBrowserLanguage()).toBe('nl');
    });
  });

  it('falls back to primary tag when full locale unsupported', () => {
    withNavigator({ language: 'es-ES', languages: ['en-US', 'es-ES'] }, () => {
      expect(detectBrowserLanguage()).toBe('en');
    });
  });

  it('uses languages array priority', () => {
    withNavigator({ languages: ['es-ES', 'nl'] }, () => {
      expect(detectBrowserLanguage()).toBe('nl');
    });
  });
});
