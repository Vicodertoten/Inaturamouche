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
  const removeEmojis = (text = '') => text.replace(/[🎉😟]/gu, '').trim();

  const { primary: primaryName, secondary: secondaryName } = getTaxonDisplayNames(bonne_reponse);
  const imageUrl = bonne_reponse.image_url || (question.image_urls && question.image_urls[0]);
  const wikipediaUrl = bonne_reponse.wikipedia_url;
  const summaryTitle = removeEmojis(isWin ? t('summary.win_title') : t('summary.lose_title'));
  const combinedBonus = scoreInfo ? (scoreInfo.bonus || 0) + (scoreInfo.streakBonus || 0) : 0;
  const scoreSegments = scoreInfo
    ? [
        { id: 'points', label: t('summary.points'), value: `+${scoreInfo.points}` },
        { id: 'bonus', label: t('summary.bonus'), value: `+${combinedBonus}` },
        { id: 'total', label: t('summary.total'), value: `+${scoreInfo.points + combinedBonus}` },
      ]
    : [];

  return (
    <div className="modal-backdrop">
      <div className="modal-content summary-modal" role="dialog" aria-modal="true">
        <h2 className={`summary-title ${isWin ? 'win' : 'lose'}`}>
          {summaryTitle}
        </h2>

        <div className="correct-answer-section">
          <img
            src={getSizedImageUrl(imageUrl, 'medium')}
            srcSet={`${getSizedImageUrl(imageUrl, 'small')} 300w, ${getSizedImageUrl(imageUrl, 'medium')} 600w`}
            sizes="(max-width: 600px) 100vw, 400px"
            alt={primaryName || secondaryName}
            className="answer-image"
            {...(supportsLazyLoading ? { loading: 'lazy' } : {})}
            decoding={imageUrl ? 'async' : undefined}
            fetchPriority={imageUrl ? 'high' : undefined}
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
          <div className="score-section" aria-live="polite">
            {scoreSegments.map((segment, index) => (
              <React.Fragment key={segment.id}>
                <span className="score-label">{segment.label}</span>
                <span className="score-value">{segment.value}</span>
                {index < scoreSegments.length - 1 && (
                  <span className="score-divider" aria-hidden="true">•</span>
                )}
              </React.Fragment>
            ))}
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
