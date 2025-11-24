import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import fr from '../locales/fr';
import en from '../locales/en';
import nl from '../locales/nl';

const MESSAGES = { fr, en, nl };
const DEFAULT_LANGUAGE = 'fr';
const LANGUAGE_STORAGE_KEY = 'inaturamouche_lang';
const NAME_FORMAT_STORAGE_KEY = 'user_pref_name_format';
const LEGACY_SCIENTIFIC_STORAGE_KEY = 'inaturamouche_scientific';
const DEFAULT_NAME_FORMAT = 'vernacular';

const LanguageContext = createContext(null);

function getStoredLanguage() {
  if (typeof window === 'undefined') return DEFAULT_LANGUAGE;
  const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
  return stored && MESSAGES[stored] ? stored : DEFAULT_LANGUAGE;
}

function getStoredNameFormat() {
  if (typeof window === 'undefined') return DEFAULT_NAME_FORMAT;
  const stored = localStorage.getItem(NAME_FORMAT_STORAGE_KEY);
  if (stored === 'vernacular' || stored === 'scientific') return stored;

  // Legacy fallback: migrate the previous boolean preference
  const legacyScientificPreference = localStorage.getItem(LEGACY_SCIENTIFIC_STORAGE_KEY);
  if (legacyScientificPreference === '1') return 'scientific';
  return DEFAULT_NAME_FORMAT;
}

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(getStoredLanguage);
  const [nameFormat, setNameFormat] = useState(getStoredNameFormat);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    document.documentElement.lang = language;
  }, [language]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(NAME_FORMAT_STORAGE_KEY, nameFormat);
    // Clean legacy key to avoid stale state when switching between versions
    localStorage.removeItem(LEGACY_SCIENTIFIC_STORAGE_KEY);
  }, [nameFormat]);

  const setLanguage = useCallback((nextLanguage) => {
    setLanguageState((prev) => {
      if (!nextLanguage || !MESSAGES[nextLanguage]) return prev;
      return nextLanguage;
    });
  }, []);

  const t = useCallback(
    (key, values = {}, fallback) => {
      const dictionary = MESSAGES[language] || MESSAGES[DEFAULT_LANGUAGE];
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
    [language]
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

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      availableLanguages: Object.keys(MESSAGES),
      languageNames: MESSAGES[language]?.languageNames ?? {},
      nameFormat,
      toggleNameFormat,
      t,
      formatTaxonName,
      getTaxonDisplayNames,
    }),
    [
      formatTaxonName,
      getTaxonDisplayNames,
      language,
      setLanguage,
      toggleNameFormat,
      t,
      nameFormat,
    ]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used within a LanguageProvider');
  return context;
}
