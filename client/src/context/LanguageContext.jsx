/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import fr from '../locales/fr';
import { formatDate as _formatDate, formatNumber as _formatNumber } from '../utils/formatters';

const DEFAULT_LANGUAGE = 'fr';
const LANGUAGE_STORAGE_KEY = 'inaturamouche_lang';
const NAME_FORMAT_STORAGE_KEY = 'user_pref_name_format';
const LEGACY_SCIENTIFIC_STORAGE_KEY = 'inaturamouche_scientific';
const DEFAULT_NAME_FORMAT = 'vernacular';
const FALLBACK_LANGUAGE_NAMES = {
  fr: 'Français',
  en: 'English',
  nl: 'Nederlands',
};
const LANGUAGE_LOADERS = {
  fr: async () => fr,
  en: async () => (await import('../locales/en')).default,
  nl: async () => (await import('../locales/nl')).default,
};

const LanguageContext = createContext(null);

function safeStorageGet(key) {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeStorageSet(key, value) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Ignore blocked storage contexts (private mode / strict browser settings).
  }
}

function safeStorageRemove(key) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore blocked storage contexts.
  }
}


function getStoredLanguage() {
  const stored = safeStorageGet(LANGUAGE_STORAGE_KEY);
  if (stored && LANGUAGE_LOADERS[stored]) return stored;
  // fall back to detecting browser preference
  return detectBrowserLanguage();
}

function getStoredNameFormat() {
  const stored = safeStorageGet(NAME_FORMAT_STORAGE_KEY);
  if (stored === 'vernacular' || stored === 'scientific') return stored;

  // Legacy fallback: migrate the previous boolean preference
  const legacyScientificPreference = safeStorageGet(LEGACY_SCIENTIFIC_STORAGE_KEY);
  if (legacyScientificPreference === '1') return 'scientific';
  return DEFAULT_NAME_FORMAT;
}

export function detectBrowserLanguage() {
  if (typeof navigator === 'undefined') return DEFAULT_LANGUAGE;

  const candidates = [];
  if (Array.isArray(navigator.languages)) candidates.push(...navigator.languages);
  if (navigator.language) candidates.push(navigator.language);
  if (navigator.userLanguage) candidates.push(navigator.userLanguage);

  for (let lang of candidates) {
    if (!lang) continue;
    const primary = lang.split('-')[0];
    if (LANGUAGE_LOADERS[lang]) return lang;
    if (LANGUAGE_LOADERS[primary]) return primary;
  }
  return DEFAULT_LANGUAGE;
}

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(getStoredLanguage);
  const [nameFormat, setNameFormat] = useState(getStoredNameFormat);
  const [messagesByLanguage, setMessagesByLanguage] = useState(() => ({
    [DEFAULT_LANGUAGE]: fr,
  }));

  const loadLanguageMessages = useCallback(async (nextLanguage) => {
    if (!LANGUAGE_LOADERS[nextLanguage]) return;
    if (messagesByLanguage[nextLanguage]) return;
    try {
      const loaded = await LANGUAGE_LOADERS[nextLanguage]();
      setMessagesByLanguage((prev) => {
        if (prev[nextLanguage]) return prev;
        return { ...prev, [nextLanguage]: loaded };
      });
    } catch {
      // Ignore transient import errors and keep fallback language active.
    }
  }, [messagesByLanguage]);

  useEffect(() => {
    safeStorageSet(LANGUAGE_STORAGE_KEY, language);
    document.documentElement.lang = language;
  }, [language]);

  useEffect(() => {
    void loadLanguageMessages(language);
  }, [language, loadLanguageMessages]);

  useEffect(() => {
    safeStorageSet(NAME_FORMAT_STORAGE_KEY, nameFormat);
    // Clean legacy key to avoid stale state when switching between versions
    safeStorageRemove(LEGACY_SCIENTIFIC_STORAGE_KEY);
  }, [nameFormat]);

  const setLanguage = useCallback((nextLanguage) => {
    setLanguageState((prev) => {
      if (!nextLanguage || !LANGUAGE_LOADERS[nextLanguage]) return prev;
      return nextLanguage;
    });
    void loadLanguageMessages(nextLanguage);
  }, [loadLanguageMessages]);

  const t = useCallback(
    (key, values = {}, fallback) => {
      const dictionary = messagesByLanguage[language] || messagesByLanguage[DEFAULT_LANGUAGE];
      const parts = key.split('.');
      let result = dictionary;
      for (const part of parts) {
        if (result && Object.prototype.hasOwnProperty.call(result, part)) {
          result = result[part];
        } else {
          result = undefined;
          break;
        }
      }
      const template = typeof result === 'string' ? result : fallback ?? key;
      return Object.keys(values).reduce((acc, token) => {
        const value = values[token];
        return acc.replace(new RegExp(`\\{${token}\\}`, 'g'), value ?? '');
      }, template);
    },
    [language, messagesByLanguage]
  );

  const toggleNameFormat = useCallback((format) => {
    setNameFormat((prev) => {
      if (format !== 'scientific' && format !== 'vernacular') return prev;
      return format;
    });
  }, []);

  const formatTaxonName = useCallback(
    (taxon = {}, fallback = '') => {
      if (!taxon) return fallback;
      const scientific = taxon.name || '';
      const common =
        taxon.preferred_common_name || taxon.common_name || taxon.commonName || '';
      if (nameFormat === 'scientific') return scientific || common || fallback;
      return common || scientific || fallback;
    },
    [nameFormat]
  );

  const getTaxonDisplayNames = useCallback(
    (taxon = {}, fallback = '') => {
      const primary = formatTaxonName(taxon, fallback);
      const scientific = taxon?.name || '';
      const common =
        taxon?.preferred_common_name || taxon?.common_name || taxon?.commonName || '';
      let secondary = '';
      if (nameFormat === 'scientific') {
        if (common && common !== primary) secondary = common;
      } else if (scientific && scientific !== primary) {
        secondary = scientific;
      }
      return { primary, secondary };
    },
    [formatTaxonName, nameFormat]
  );

  const formatDate = useCallback((date, opts) => {
    return _formatDate(date, language, opts);
  }, [language]);

  const formatNumber = useCallback((value, opts) => {
    return _formatNumber(value, language, opts);
  }, [language]);

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      availableLanguages: Object.keys(LANGUAGE_LOADERS),
      languageNames:
        messagesByLanguage[language]?.languageNames ??
        messagesByLanguage[DEFAULT_LANGUAGE]?.languageNames ??
        FALLBACK_LANGUAGE_NAMES,
      nameFormat,
      toggleNameFormat,
      t,
      formatTaxonName,
      getTaxonDisplayNames,
      formatDate,
      formatNumber,
    }),
    [
      formatTaxonName,
      getTaxonDisplayNames,
      language,
      messagesByLanguage,
      setLanguage,
      toggleNameFormat,
      t,
      nameFormat,
      formatDate,
      formatNumber,
    ]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used within a LanguageProvider');
  return context;
}
