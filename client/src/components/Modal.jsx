import React, { useEffect } from 'react';
import './Modal.css';
import { useLanguage } from '../context/LanguageContext.jsx';

function Modal({ onClose, children }) {
  const { t } = useLanguage();
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-content" tabIndex="-1" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          onClick={onClose}
          className="close-button"
          title={t('common.close')}
          aria-label={t('common.close')}
        >
          ×
        </button>
        {children}
      </div>
    </div>
  );
}

export default Modal;
