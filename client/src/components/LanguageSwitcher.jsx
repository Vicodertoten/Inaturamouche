import React from 'react';
import { useLanguage } from '../context/LanguageContext.jsx';

const FLAGS = {
  fr: '🇫🇷',
  en: '🇬🇧',
  nl: '🇳🇱',
};

function LanguageSwitcher() {
  const { language, setLanguage, availableLanguages, languageNames, t } = useLanguage();

  return (
    <div className="language-switcher" role="group" aria-label={t('common.language_switcher_label')}>
      {availableLanguages.map((code) => (
        <button
          key={code}
          className={language === code ? 'active' : ''}
          onClick={() => setLanguage(code)}
          title={languageNames[code] || code.toUpperCase()}
          aria-label={`${t('common.language_switcher_label')} ${languageNames[code] || code.toUpperCase()}`}
        >
          {FLAGS[code] || code.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

export default LanguageSwitcher;
