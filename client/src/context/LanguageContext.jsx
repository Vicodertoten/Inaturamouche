import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import fr from '../locales/fr';
import en from '../locales/en';
import nl from '../locales/nl';

const MESSAGES = { fr, en, nl };
const DEFAULT_LANGUAGE = 'fr';
const LANGUAGE_STORAGE_KEY = 'inaturamouche_lang';
const SCIENTIFIC_STORAGE_KEY = 'inaturamouche_scientific';

const LanguageContext = createContext(null);

function getStoredLanguage() {
  if (typeof window === 'undefined') return DEFAULT_LANGUAGE;
  const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
  return stored && MESSAGES[stored] ? stored : DEFAULT_LANGUAGE;
}

function getStoredScientificPreference() {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(SCIENTIFIC_STORAGE_KEY) === '1';
}

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(getStoredLanguage);
  const [useScientificName, setUseScientificName] = useState(getStoredScientificPreference);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    document.documentElement.lang = language;
  }, [language]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(SCIENTIFIC_STORAGE_KEY, useScientificName ? '1' : '0');
  }, [useScientificName]);

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

  const formatTaxonName = useCallback(
    (taxon = {}, fallback = '') => {
      if (!taxon) return fallback;
      const scientific = taxon.name || '';
      const common =
        taxon.preferred_common_name || taxon.common_name || taxon.commonName || '';
      if (useScientificName) return scientific || common || fallback;
      return common || scientific || fallback;
    },
    [useScientificName]
  );

  const getTaxonDisplayNames = useCallback(
    (taxon = {}, fallback = '') => {
      const primary = formatTaxonName(taxon, fallback);
      const scientific = taxon?.name || '';
      const common =
        taxon?.preferred_common_name || taxon?.common_name || taxon?.commonName || '';
      let secondary = '';
      if (useScientificName) {
        if (common && common !== primary) secondary = common;
      } else if (scientific && scientific !== primary) {
        secondary = scientific;
      }
      return { primary, secondary };
    },
    [formatTaxonName, useScientificName]
  );

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      availableLanguages: Object.keys(MESSAGES),
      languageNames: MESSAGES[language]?.languageNames ?? {},
      useScientificName,
      setUseScientificName,
      t,
      formatTaxonName,
      getTaxonDisplayNames,
    }),
    [formatTaxonName, getTaxonDisplayNames, language, t, useScientificName, setLanguage]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used within a LanguageProvider');
  return context;
}
