import React from 'react';
import Modal from './Modal';
import { useLanguage } from '../context/LanguageContext.jsx';

function ErrorModal({ message, onClose, onRetry }) {
  const { t } = useLanguage();
  return (
    <Modal onClose={onClose}>
      <div className="error-modal">
        <h2 className="modal-title">{t('errors.title')}</h2>
        <p>{message || t('errors.generic')}</p>
        <div className="modal-actions">
          {onRetry && (
            <button type="button" className="btn btn--primary" onClick={onRetry}>
              {t('errors.retry')}
            </button>
          )}
          <button type="button" className="btn btn--secondary" onClick={onClose}>
            {t('common.close')}
          </button>
        </div>
      </div>
    </Modal>
  );
}

export default ErrorModal;
