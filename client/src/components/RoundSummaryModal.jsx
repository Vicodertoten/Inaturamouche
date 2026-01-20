import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import './RoundSummaryModal.css';
import { getSizedImageUrl } from '../utils/imageUtils';
import { useLanguage } from '../context/LanguageContext.jsx';
import { fetchExplanation } from '../services/api';

const supportsLazyLoading =
  typeof HTMLImageElement !== 'undefined' && 'loading' in HTMLImageElement.prototype;

// Composant interne pour l'effet machine à écrire
const Typewriter = ({ text, speed = 20, onComplete }) => {
  const [displayed, setDisplayed] = useState('');
  
  useEffect(() => {
    setDisplayed(''); // Reset si le texte change
    let i = 0;
    const timer = setInterval(() => {
      if (i < text.length) {
        setDisplayed((prev) => prev + text.charAt(i));
        i++;
      } else {
        clearInterval(timer);
        if (onComplete) onComplete();
      }
    }, speed);
    return () => clearInterval(timer);
  }, [text, speed, onComplete]);

  return <p className="explanation-section__text">{displayed}</p>;
};

const RoundSummaryModal = ({ status, question, onNext, userAnswer, explanationContext }) => {
  const { t, lang, getTaxonDisplayNames } = useLanguage();
  const [explanation, setExplanation] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const buttonRef = useRef(null);
  const previousActiveRef = useRef(null);
  const isWin = status === 'win';

  // Helper to extract relevant details from a taxon object, handling EasyMode's 'detail' structure
  const getTaxonDetailsForDisplay = useCallback((taxonData) => {
    const actualTaxon = taxonData?.detail || taxonData;
    if (!actualTaxon) return {};

    const { primary, secondary } = getTaxonDisplayNames(actualTaxon);
    return {
      id: actualTaxon.id || actualTaxon.taxon_id,
      image_url: actualTaxon.default_photo?.url || actualTaxon.image_url,
      wikipedia_url: actualTaxon.wikipedia_url,
      inaturalist_url: actualTaxon.url || (actualTaxon.id || actualTaxon.taxon_id ? `https://www.inaturalist.org/taxa/${actualTaxon.id || actualTaxon.taxon_id}` : undefined), // Robust iNaturalist URL
      primaryName: primary,
      secondaryName: secondary,
    };
  }, [getTaxonDisplayNames]);

  const correctDisplayTaxon = useMemo(() => {
    const taxon = getTaxonDetailsForDisplay(question?.bonne_reponse);
    // Override iNaturalist URL with observation-specific one if available
    if (question?.inaturalist_url) {
      taxon.inaturalist_url = question.inaturalist_url;
    }
    return taxon;
  }, [question, getTaxonDetailsForDisplay]);
  const userDisplayTaxon = useMemo(() => getTaxonDetailsForDisplay(userAnswer), [userAnswer, getTaxonDetailsForDisplay]);
  const explanationCorrectId = explanationContext?.correctId || correctDisplayTaxon.id;
  const explanationWrongId = explanationContext?.wrongId || userDisplayTaxon.id;
  const explanationFocusRank = explanationContext?.focusRank || null;

  useEffect(() => {
    let isActive = true; // Drapeau pour éviter les race conditions (double réponse)

    // On utilise les IDs comme dépendances pour éviter les re-renders inutiles sur changement d'objet
    if (!isWin && explanationCorrectId && explanationWrongId) {
      const fetchExplanationAsync = async () => {
        setIsLoading(true);
        setExplanation(''); // Clear previous explanation
        try {
          const data = await fetchExplanation(
            explanationCorrectId,
            explanationWrongId,
            lang,
            explanationFocusRank
          );
          if (isActive) {
            setExplanation(data.explanation);
          }
        } catch (error) {
          console.error('Failed to fetch explanation:', error);
          if (isActive) setExplanation('');
        } finally {
          if (isActive) setIsLoading(false);
        }
      };
      fetchExplanationAsync();
    } else if (!isWin) {
      // Logique existante...
    }
    
    return () => {
      isActive = false; // Cleanup: ignore les résultats si le composant est démonté/rechargé
    };
  }, [isWin, explanationCorrectId, explanationWrongId, explanationFocusRank, lang]);

  useEffect(() => {
    previousActiveRef.current = document.activeElement;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' || event.key === 'Enter') {
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

  const title = isWin ? t('summary.win_title') : t('summary.lose_title');
  const titleIcon = isWin ? '🎉' : '😟';
  const hideUserImage = question?.game_mode === 'riddle';

  return (
    <div className="modal-backdrop">
      <div className="modal-content summary-modal" role="dialog" aria-modal="true" aria-labelledby="summary-title">
        <header className="summary-header">
          <h2 id="summary-title" className={`summary-title ${isWin ? 'win' : 'lose'}`}>
            <span className="summary-title-icon" aria-hidden="true">{titleIcon}</span>
            {title}
          </h2>
        </header>

        <div className="summary-body">
          <div className="answers-container">
            {/* Correct Answer Card */}
            <div className={`answer-card correct-answer-card ${isWin ? 'full-width' : ''}`}>
              <h3 className="answer-card-title">{t('summary.correct_answer')}</h3>
              <div className="answer-card-body">
                {correctDisplayTaxon.image_url && (
                  <div className="answer-image-wrapper">
                    <img
                      src={getSizedImageUrl(correctDisplayTaxon.image_url, 'medium')}
                      srcSet={`${getSizedImageUrl(correctDisplayTaxon.image_url, 'small')} 300w, ${getSizedImageUrl(correctDisplayTaxon.image_url, 'medium')} 600w`}
                      sizes="(max-width: 768px) 120px, 200px"
                      alt={correctDisplayTaxon.primaryName || correctDisplayTaxon.secondaryName}
                      className="answer-image"
                      {...(supportsLazyLoading ? { loading: 'lazy' } : {})}
                    />
                  </div>
                )}
                <div className="answer-details">
                  {correctDisplayTaxon.primaryName && <p className="answer-name">{correctDisplayTaxon.primaryName}</p>}
                  {correctDisplayTaxon.secondaryName && <p className="answer-scientific-name"><em>{correctDisplayTaxon.secondaryName}</em></p>}
                  <div className="external-links-container modal-links">
                    {correctDisplayTaxon.inaturalist_url && (
                      <a href={correctDisplayTaxon.inaturalist_url} target="_blank" rel="noopener noreferrer" className="external-link">
                        {t('summary.links.inaturalist')}
                      </a>
                    )}
                    {correctDisplayTaxon.wikipedia_url && (
                      <a href={correctDisplayTaxon.wikipedia_url} target="_blank" rel="noopener noreferrer" className="external-link">
                        {t('summary.links.wikipedia')}
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* User Answer Card (only if wrong) */}
            {!isWin && userAnswer && (
              <div className="answer-card user-answer-card">
                <h3 className="answer-card-title">{t('summary.your_answer')}</h3>
                <div className="answer-card-body">
                  {!hideUserImage && userDisplayTaxon.image_url && (
                    <div className="answer-image-wrapper">
                      <img
                        src={getSizedImageUrl(userDisplayTaxon.image_url, 'medium')}
                        srcSet={`${getSizedImageUrl(userDisplayTaxon.image_url, 'small')} 300w, ${getSizedImageUrl(userDisplayTaxon.image_url, 'medium')} 600w`}
                        sizes="(max-width: 768px) 120px, 200px"
                        alt={userDisplayTaxon.primaryName || userDisplayTaxon.secondaryName}
                        className="answer-image"
                        {...(supportsLazyLoading ? { loading: 'lazy' } : {})}
                      />
                    </div>
                  )}
                  <div className="answer-details">
                    {userDisplayTaxon.primaryName && <p className="answer-name">{userDisplayTaxon.primaryName}</p>}
                    {userDisplayTaxon.secondaryName && <p className="answer-scientific-name"><em>{userDisplayTaxon.secondaryName}</em></p>}
                    <div className="external-links-container modal-links">
                      {userDisplayTaxon.inaturalist_url && (
                        <a href={userDisplayTaxon.inaturalist_url} target="_blank" rel="noopener noreferrer" className="external-link">
                          {t('summary.links.inaturalist')}
                        </a>
                      )}
                      {userDisplayTaxon.wikipedia_url && (
                        <a href={userDisplayTaxon.wikipedia_url} target="_blank" rel="noopener noreferrer" className="external-link">
                          {t('summary.links.wikipedia')}
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Explanation Section (only if wrong) */}
          {!isWin && (
            <div className="summary-card explanation-section">
              {/* Header avec Avatar au lieu du texte statique */}
              <div className="explanation-header">
                <div className="prof-mouche-avatar" aria-hidden="true">
                  {/* Remplacez cet emoji par une <img> si vous avez un asset */}
                  🪰
                </div>
                <div className="explanation-bubble-tip"></div>
              </div>
              
              <div className="explanation-content">
                {isLoading ? (
                  <div className="explanation-section__loader">
                    <div className="spinner"></div>
                  </div>
                ) : (
                  explanation && <Typewriter text={explanation} speed={20} />
                )}
              </div>
            </div>
          )}
        </div>

        <footer className="summary-footer">
          <button ref={buttonRef} onClick={onNext} className="btn btn--primary next-button">
            {t('common.next_question')}
          </button>
        </footer>
      </div>
    </div>
  );
};

export default RoundSummaryModal;
