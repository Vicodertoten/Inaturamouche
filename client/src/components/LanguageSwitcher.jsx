import React from 'react';

function LanguageSwitcher({ currentLanguage, onLanguageChange }) {
  return (
    <div className="language-switcher">
      <button 
        className={currentLanguage === 'fr' ? 'active' : ''}
        onClick={() => onLanguageChange('fr')}
        title="Français"
      >
        🇫🇷
      </button>
      <button 
        className={currentLanguage === 'en' ? 'active' : ''}
        onClick={() => onLanguageChange('en')}
        title="English"
      >
        🇬🇧
      </button>
    </div>
  );
}

export default LanguageSwitcher;