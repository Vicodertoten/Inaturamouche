import React, { useEffect, useRef } from 'react';
import './RoundSummaryModal.css';
import { getSizedImageUrl } from '../utils/imageUtils';
import { useLanguage } from '../context/LanguageContext.jsx';

// Detect support for native lazy-loading on images.
// Fallback: without support (e.g. Safari), images load immediately.
// An IntersectionObserver could be used here to manually defer loading.
const supportsLazyLoading =
  typeof HTMLImageElement !== 'undefined' && 'loading' in HTMLImageElement.prototype;


// Affiche le récapitulatif d'une manche avec le résultat (victoire/défaite)
const RoundSummaryModal = ({ status, question, scoreInfo, onNext }) => {
  const { t, getTaxonDisplayNames } = useLanguage();

  const buttonRef = useRef(null);
  const previousActiveRef = useRef(null);

  useEffect(() => {
    previousActiveRef.current = document.activeElement;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onNext();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    if (buttonRef.current) {
      buttonRef.current.focus();
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (previousActiveRef.current && previousActiveRef.current.focus) {
        previousActiveRef.current.focus();
      }
    };
  }, [onNext]);

  if (!question || !question.bonne_reponse) {
    return null;
  }

  const { bonne_reponse, inaturalist_url } = question;

  const isWin = status === 'win';

  const { primary: primaryName, secondary: secondaryName } = getTaxonDisplayNames(bonne_reponse);
  const imageUrl = bonne_reponse.image_url || (question.image_urls && question.image_urls[0]);
  const wikipediaUrl = bonne_reponse.wikipedia_url;

  return (
    <div className="modal-backdrop">
      <div className="modal-content summary-modal" role="dialog" aria-modal="true">
        <h2 className={isWin ? 'win-title' : 'lose-title'}>
          {isWin ? t('summary.win_title') : t('summary.lose_title')}
        </h2>

        <div className="correct-answer-section">
          <p>{t('summary.answer_intro')}</p>
          <img
            src={getSizedImageUrl(imageUrl, 'medium')}
            srcSet={`${getSizedImageUrl(imageUrl, 'small')} 300w, ${getSizedImageUrl(imageUrl, 'medium')} 600w`}
            sizes="(max-width: 600px) 100vw, 400px"
            alt={primaryName || secondaryName}
            className="answer-image"
            {...(supportsLazyLoading ? { loading: 'lazy' } : {})}
            decoding={imageUrl ? 'async' : undefined}
            fetchpriority={imageUrl ? 'high' : undefined}
          />
          
          {primaryName && <h3 className="answer-name">{primaryName}</h3>}
          {secondaryName && (
            <p className="answer-scientific-name"><em>{secondaryName}</em></p>
          )}
          
          <div className="external-links-container modal-links">
            <a href={inaturalist_url} target="_blank" rel="noopener noreferrer" className="external-link">
              {t('summary.links.inaturalist')}
            </a>
            {wikipediaUrl && (
              <a href={wikipediaUrl} target="_blank" rel="noopener noreferrer" className="external-link">
                {t('summary.links.wikipedia')}
              </a>
            )}
          </div>
        </div>

        {scoreInfo && (
          <div className="score-section">
            <p>{t('summary.points')} <span className="score-points">+{scoreInfo.points}</span></p>
            {scoreInfo.bonus > 0 && (
              <p>{t('summary.bonus')} <span className="score-points">+{scoreInfo.bonus}</span></p>
            )}
            {scoreInfo.streakBonus > 0 && (
              <p>{t('summary.streak_bonus')} <span className="score-points">+{scoreInfo.streakBonus}</span></p>
            )}
            <p>{t('summary.total')} <span className="score-total">+{scoreInfo.points + (scoreInfo.bonus || 0) + (scoreInfo.streakBonus || 0)}</span></p>
          </div>
        )}
        
        <button ref={buttonRef} onClick={onNext} className="start-button-modal">
          {t('common.next_question')}
        </button>
      </div>
    </div>
  );
};

export default RoundSummaryModal;
