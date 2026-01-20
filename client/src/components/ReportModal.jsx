// src/components/ReportModal.jsx

import React, { useState, useEffect, useId } from 'react';
import './ReportModal.css'; // We'll create this CSS file
import { useLanguage } from '../context/LanguageContext.jsx';

function ReportModal({ onClose }) {
  const { t } = useLanguage();
  const titleId = useId();
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!description.trim()) return;

    setIsSubmitting(true);

    try {
      // Envoyer le rapport au serveur
      const response = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description,
          url: window.location.href,
          userAgent: navigator.userAgent
        }),
      });

      if (response.ok) {
        alert('Merci pour votre signalement ! Le rapport a été envoyé avec succès.');
        onClose();
      } else {
        throw new Error('Erreur lors de l\'envoi du rapport');
      }
    } catch (error) {
      console.error('Erreur lors de l\'envoi du signalement:', error);
      alert('Erreur lors de l\'envoi. Veuillez réessayer.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="modal-content report-modal"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <button onClick={onClose} className="close-button" title={t('common.close')} aria-label={t('common.close')}>×</button>
        
        <h2 id={titleId} className="modal-title">🚩 Signaler un problème</h2>

        <p>
          Les données iNaturalist sont communautaires. Si vous remarquez une photo de mauvaise qualité ou une identification incorrecte, 
          signalez-le ici pour que nous puissions améliorer l'expérience.
        </p>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="report-description">Description du problème :</label>
            <textarea
              id="report-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Décrivez le problème (ex: photo floue, mauvaise identification, etc.)"
              required
              rows={4}
            />
          </div>

          <div className="form-actions">
            <button type="button" onClick={onClose} className="btn btn--secondary">
              Annuler
            </button>
            <button type="submit" className="btn btn--primary" disabled={isSubmitting || !description.trim()}>
              {isSubmitting ? 'Envoi...' : 'Envoyer le signalement'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ReportModal;