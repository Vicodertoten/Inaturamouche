// src/components/HelpModal.jsx

import React, { useEffect } from 'react';
import './HelpModal.css'; // Nous allons créer ce fichier CSS juste après
import { useLanguage } from '../context/LanguageContext.jsx';

function HelpModal({ onClose }) {
  const { t } = useLanguage();
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    document.querySelector('.modal-content')?.focus();

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  return (
    // Le fond assombri qui ferme le modal au clic
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      {/* On empêche la propagation du clic pour que le modal ne se ferme pas quand on clique dessus */}
      <div className="modal-content help-modal" tabIndex="-1" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="close-button" title="Fermer" aria-label="Fermer">×</button>
        
        <h2 className="modal-title">{t('help.title')}</h2>

        <div className="help-section">
          <h4>{t('help.gameplay_title')}</h4>
          <p>{t('help.gameplay_body')}</p>
        </div>

        <div className="help-section">
          <h4>{t('help.modes_title')}</h4>
          <ul>
            <li>
              <strong>{t('home.easy_mode')} :</strong> {t('help.modes_easy')}
            </li>
            <li>
              <strong>{t('home.hard_mode')} :</strong> {t('help.modes_hard')}
            </li>
          </ul>
        </div>
        
        <div className="help-section">
          <h4>{t('help.packs_title')}</h4>
          <p>{t('help.packs_body')}</p>
        </div>

        <button onClick={onClose} className="start-button-modal">{t('help.confirm')}</button>
      </div>
    </div>
  );
}

export default HelpModal;
