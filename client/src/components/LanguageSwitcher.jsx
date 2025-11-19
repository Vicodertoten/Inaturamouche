import React, { useId } from 'react';
import { useLanguage } from '../context/LanguageContext.jsx';

const LANGUAGE_OPTIONS = [
  { code: 'en', label: 'EN' },
  { code: 'fr', label: 'FR' },
  { code: 'nl', label: 'NL' },
];

function LanguageSwitcher() {
  const { language, setLanguage, t } = useLanguage();
  const selectId = useId();

  return (
    <div className="language-switcher">
      <label htmlFor={selectId} className="sr-only">
        {t('common.language_switcher_label')}
      </label>
      <select
        id={selectId}
        value={language}
        onChange={(event) => setLanguage(event.target.value)}
        aria-label={t('common.language_switcher_label')}
        title={t('common.language_switcher_label')}
      >
        {LANGUAGE_OPTIONS.map(({ code, label }) => (
          <option key={code} value={code}>
            {label}
          </option>
        ))}
      </select>
    </div>
  );
}

export default LanguageSwitcher;
