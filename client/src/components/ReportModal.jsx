// src/components/ReportModal.jsx

import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import './ReportModal.css'; // We'll create this CSS file
import { useLanguage } from '../context/LanguageContext.jsx';
import { submitBugReport } from '../services/api.js';
import { notify } from '../services/notifications.js';
import { debugError } from '../utils/logger.js';

function ReportModal({ onClose }) {
  const { t } = useLanguage();
  const titleId = useId();
  const [description, setDescription] = useState('');
  const [website, setWebsite] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const modalRef = useRef(null);
  const descriptionRef = useRef(null);
  const previousFocusRef = useRef(null);

  const getFocusableElements = useCallback(() => {
    if (!modalRef.current) return [];
    const selectors = [
      'button:not([disabled])',
      'a[href]',
      'textarea:not([disabled])',
      'input:not([type="hidden"]):not([disabled])',
      'select:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
    ];
    return Array.from(modalRef.current.querySelectorAll(selectors.join(','))).filter((el) => {
      if (!(el instanceof HTMLElement)) return false;
      return !el.hasAttribute('aria-hidden') && el.tabIndex >= 0;
    });
  }, []);

  useEffect(() => {
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const focusTimer = window.setTimeout(() => {
      descriptionRef.current?.focus();
    }, 0);

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }

      if (e.key !== 'Tab') return;
      const focusableElements = getFocusableElements();
      if (focusableElements.length === 0) {
        e.preventDefault();
        return;
      }

      const first = focusableElements[0];
      const last = focusableElements[focusableElements.length - 1];
      const active = document.activeElement;

      if (e.shiftKey) {
        if (active === first || !modalRef.current?.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else if (active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener('keydown', handleKeyDown);
      previousFocusRef.current?.focus();
    };
  }, [getFocusableElements, onClose]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!description.trim()) return;

    setIsSubmitting(true);

    try {
      await submitBugReport({
        description,
        website,
      });
      notify(t('report.success', {}, 'Merci pour votre signalement !'), { type: 'success' });
      onClose();
    } catch (error) {
      debugError('Erreur lors de l\'envoi du signalement:', error);
      notify(t('report.error', {}, 'Erreur lors de l’envoi. Veuillez réessayer.'), { type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="modal-content report-modal"
        ref={modalRef}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <button type="button" onClick={onClose} className="close-button" title={t('common.close')} aria-label={t('common.close')}>×</button>
        
        <h2 id={titleId} className="modal-title">🚩 {t('report.title', {}, 'Signaler un problème')}</h2>

        <p>
          {t('report.description', {}, 'Les données iNaturalist sont communautaires. Si vous remarquez une photo de mauvaise qualité ou une identification incorrecte, signalez-le ici pour que nous puissions améliorer l\'expérience.')}
        </p>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="report-description">{t('report.label', {}, 'Description du problème :')}</label>
            <textarea
              id="report-description"
              ref={descriptionRef}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('report.placeholder', {}, 'Décrivez le problème (ex: photo floue, mauvaise identification, etc.)')}
              required
              rows={4}
            />
            <input
              type="text"
              name="website"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              autoComplete="off"
              tabIndex={-1}
              className="sr-only"
              aria-hidden="true"
            />
          </div>

          <div className="form-actions">
            <button type="button" onClick={onClose} className="btn btn--secondary">
              {t('common.cancel')}
            </button>
            <button type="submit" className="btn btn--primary" disabled={isSubmitting || !description.trim()}>
              {isSubmitting ? t('report.sending', {}, 'Envoi...') : t('report.submit', {}, 'Envoyer le signalement')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ReportModal;
