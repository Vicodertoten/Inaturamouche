// src/components/HelpModal.jsx

import React, { useEffect, useId } from 'react';
import './HelpModal.css'; // Nous allons créer ce fichier CSS juste après
import { useLanguage } from '../context/LanguageContext.jsx';

function HelpModal({ onClose }) {
  const { t } = useLanguage();
  const titleId = useId();
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
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      {/* On empêche la propagation du clic pour que le modal ne se ferme pas quand on clique dessus */}
      <div
        className="modal-content help-modal"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <button onClick={onClose} className="close-button" title={t('common.close')} aria-label={t('common.close')}>×</button>
        
        <h2 id={titleId} className="modal-title">{t('help.title')}</h2>

        <section className="help-section" aria-labelledby={`${titleId}-gameplay`}>
          <h3 id={`${titleId}-gameplay`}>{t('help.gameplay_title')}</h3>
          <p>{t('help.gameplay_body')}</p>
        </section>

        <section className="help-section" aria-labelledby={`${titleId}-modes`}>
          <h3 id={`${titleId}-modes`}>{t('help.modes_title')}</h3>
          <ul>
            <li>
              <strong>{t('home.easy_mode')} :</strong> {t('help.modes_easy')}
            </li>
            <li>
              <strong>{t('home.riddle_mode')} :</strong> {t('help.modes_riddle')}
            </li>
            <li>
              <strong>{t('home.hard_mode')} :</strong> {t('help.modes_hard')}
            </li>
          </ul>
        </section>
        
        <section className="help-section" aria-labelledby={`${titleId}-packs`}>
          <h3 id={`${titleId}-packs`}>{t('help.packs_title')}</h3>
          <p>{t('help.packs_body')}</p>
        </section>

        <button onClick={onClose} className="btn btn--primary start-button-modal">{t('help.confirm')}</button>
      </div>
    </div>
  );
}

export default HelpModal;
