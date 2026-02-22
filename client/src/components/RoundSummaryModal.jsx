import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import './RoundSummaryModal.css';
import { getSizedImageUrl } from '../utils/imageUtils';
import { toSafeHttpUrl } from '../utils/mediaUtils';
import { useLanguage } from '../context/LanguageContext.jsx';
import { fetchExplanation, getTaxonDetails } from '../services/api';

const supportsLazyLoading =
  typeof HTMLImageElement !== 'undefined' && 'loading' in HTMLImageElement.prototype;

// Composant interne pour l'effet machine à écrire
const Typewriter = ({ text, speed = 20, onComplete, onHeightChange }) => {
  const [displayed, setDisplayed] = useState('');
  const textRef = useRef(null);
  
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

  useEffect(() => {
    if (!textRef.current || !onHeightChange) return;
    const nextHeight = textRef.current.scrollHeight;
    if (nextHeight > 0) {
      onHeightChange(nextHeight);
    }
  }, [displayed, onHeightChange]);

  return (
    <p ref={textRef} className="explanation-section__text">
      {displayed}
    </p>
  );
};

const getObservationImageUrl = (taxon) => {
  if (!taxon) return null;
  return (
    taxon.default_photo?.medium_url ||
    taxon.default_photo?.square_url ||
    taxon.default_photo?.url ||
    null
  );
};

const RoundSummaryModal = ({ status, question, onNext, userAnswer, explanationContext }) => {
  const { t, language, getTaxonDisplayNames } = useLanguage();
  const lang = language; // Alias pour compatibilité
  const [explanation, setExplanation] = useState('');
  const [discriminant, setDiscriminant] = useState('');
  const [aiSources, setAiSources] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [explanationMinHeight, setExplanationMinHeight] = useState(null);
  const [userDetailOverride, setUserDetailOverride] = useState(null);
  const buttonRef = useRef(null);
  const previousActiveRef = useRef(null);
  const isWin = status === 'win';

  // Helper to extract relevant details from a taxon object, handling EasyMode's 'detail' structure
  const getTaxonDetailsForDisplay = useCallback((taxonData) => {
    const actualTaxon = taxonData?.detail || taxonData;
    if (!actualTaxon) return {};

    const { primary, secondary } = getTaxonDisplayNames(actualTaxon);
    const defaultPhoto = actualTaxon.default_photo || {};
    const imageUrl =
      defaultPhoto.url ||
      defaultPhoto.medium_url ||
      defaultPhoto.large_url ||
      defaultPhoto.square_url ||
      actualTaxon.image_url;
    return {
      id: actualTaxon.id || actualTaxon.taxon_id,
      image_url: imageUrl,
      wikipedia_url: toSafeHttpUrl(actualTaxon.wikipedia_url),
      inaturalist_url:
        toSafeHttpUrl(actualTaxon.url) ||
        (actualTaxon.id || actualTaxon.taxon_id
          ? toSafeHttpUrl(`https://www.inaturalist.org/taxa/${actualTaxon.id || actualTaxon.taxon_id}`)
          : null),
      primaryName: primary,
      secondaryName: secondary,
      scientificName: actualTaxon.name || '',
    };
  }, [getTaxonDisplayNames]);

  const correctDisplayTaxon = useMemo(() => {
    const taxon = getTaxonDetailsForDisplay(question?.bonne_reponse);
    // Override iNaturalist URL with observation-specific one if available
    if (question?.inaturalist_url) {
      taxon.inaturalist_url = toSafeHttpUrl(question.inaturalist_url);
    }
    return taxon;
  }, [question, getTaxonDetailsForDisplay]);

  const baseUserId =
    userAnswer?.detail?.id || userAnswer?.id || userAnswer?.taxon_id || null;
  const userDisplayTaxon = useMemo(
    () => getTaxonDetailsForDisplay(userDetailOverride || userAnswer),
    [userDetailOverride, userAnswer, getTaxonDetailsForDisplay]
  );
  const explanationCorrectId = explanationContext?.correctId || correctDisplayTaxon.id;
  const explanationWrongId = explanationContext?.wrongId || userDisplayTaxon.id;
  const explanationFocusRank = explanationContext?.focusRank || null;
  const userWikiUrl = useMemo(() => {
    if (userDisplayTaxon.wikipedia_url) return userDisplayTaxon.wikipedia_url;
    if (!userDisplayTaxon.scientificName) return null;
    return toSafeHttpUrl(`https://${lang}.wikipedia.org/wiki/${encodeURIComponent(userDisplayTaxon.scientificName)}`);
  }, [userDisplayTaxon.wikipedia_url, userDisplayTaxon.scientificName, lang]);

  useEffect(() => {
    setUserDetailOverride(null);
  }, [baseUserId]);

  useEffect(() => {
    let isActive = true;
    if (isWin || !baseUserId) return () => {};
    const needsPhoto = !userDisplayTaxon.image_url;
    const needsWiki = !userDisplayTaxon.wikipedia_url;
    if (!needsPhoto && !needsWiki) return () => {};

    getTaxonDetails(baseUserId, lang)
      .then((detail) => {
        if (isActive && detail) {
          setUserDetailOverride(detail);
        }
      })
      .catch(() => {});

    return () => {
      isActive = false;
    };
  }, [isWin, baseUserId, userDisplayTaxon.image_url, userDisplayTaxon.wikipedia_url, lang]);

  useEffect(() => {
    let isActive = true; // Drapeau pour éviter les race conditions (double réponse)

    // On utilise les IDs comme dépendances pour éviter les re-renders inutiles sur changement d'objet
    if (!isWin && explanationCorrectId && explanationWrongId) {
      const fetchExplanationAsync = async () => {
        setIsLoading(true);
        setExplanation(''); // Clear previous explanation
        try {
          console.debug('[RoundSummaryModal] Fetching explanation for:', {
            correctId: explanationCorrectId,
            wrongId: explanationWrongId,
          });
          const data = await fetchExplanation(
            explanationCorrectId,
            explanationWrongId,
            lang,
            explanationFocusRank
          );
          if (isActive) {
            setExplanation(data.explanation || '');
            setDiscriminant(data.discriminant || '');
            setAiSources(Array.isArray(data.sources) ? data.sources : []);
          }
        } catch (error) {
          console.error('Failed to fetch explanation:', {
            error: error.message,
            status: error.status,
            code: error.code,
            correctId: explanationCorrectId,
            wrongId: explanationWrongId,
          });
          if (isActive) {
            setExplanation('');
            setDiscriminant('');
            setAiSources([]);
          }
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
    setExplanationMinHeight(null);
  }, [explanation]);

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
  const correctImageUrl = getObservationImageUrl(question?.bonne_reponse) || correctDisplayTaxon.image_url;

  return (
    <div className="modal-backdrop">
      <div className={`modal-content summary-modal ${isWin ? 'summary-modal--win' : 'summary-modal--lose summary-modal--wide'}`} role="dialog" aria-modal="true" aria-labelledby="summary-title">
        <header className="summary-header">
          <h2 id="summary-title" className={`summary-title ${isWin ? 'win' : 'lose'}`}>
        
            {title}
          </h2>
        </header>

        <div className="summary-body">
          <div className="answers-container">
            {/* Correct Answer Card */}
            <div className={`answer-card correct-answer-card ${isWin ? 'full-width' : ''}`}>
              <h3 className="answer-card-title">{t('summary.correct_answer')}</h3>
              <div className="answer-card-body">
                {correctImageUrl && (
                  <div className="answer-image-wrapper">
                    <img
                      src={getSizedImageUrl(correctImageUrl, 'medium')}
                      srcSet={`${getSizedImageUrl(correctImageUrl, 'small')} 300w, ${getSizedImageUrl(correctImageUrl, 'medium')} 600w`}
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
                      <a
                        href={correctDisplayTaxon.inaturalist_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="external-link"
                        aria-label={t('summary.links.inaturalist')}
                      >
                        <span className="external-link__icon" aria-hidden="true">
                          <svg viewBox="0 0 24 24" role="img" focusable="false" aria-hidden="true">
                            <path d="M4 12c3.4-4.3 8.3-6.2 12.7-6.2 2.5 0 3.9 1.1 3.9 2.9 0 2.7-3.1 5.6-8.2 5.6H8.5L5.5 18v-4.2H4z" />
                          </svg>
                        </span>
                        <span className="external-link__text">{t('summary.links.inaturalist')}</span>
                      </a>
                    )}
                    {correctDisplayTaxon.wikipedia_url && (
                      <a
                        href={correctDisplayTaxon.wikipedia_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="external-link"
                        aria-label={t('summary.links.wikipedia')}
                      >
                        <span className="external-link__icon" aria-hidden="true">
                          <svg viewBox="0 0 24 24" role="img" focusable="false" aria-hidden="true">
                            <path d="M4 6h3l2.2 7.2L11.8 6h2.4l2.6 7.2L19 6h3l-4.1 12h-2.4L13 10.2 10.5 18H8.1L4 6z" />
                          </svg>
                        </span>
                        <span className="external-link__text">{t('summary.links.wikipedia')}</span>
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
                  {userDisplayTaxon.image_url && (
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
                        <a
                          href={userDisplayTaxon.inaturalist_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="external-link"
                          aria-label={t('summary.links.inaturalist')}
                        >
                          <span className="external-link__icon" aria-hidden="true">
                            <svg viewBox="0 0 24 24" role="img" focusable="false" aria-hidden="true">
                              <path d="M4 12c3.4-4.3 8.3-6.2 12.7-6.2 2.5 0 3.9 1.1 3.9 2.9 0 2.7-3.1 5.6-8.2 5.6H8.5L5.5 18v-4.2H4z" />
                            </svg>
                          </span>
                          <span className="external-link__text">{t('summary.links.inaturalist')}</span>
                        </a>
                      )}
                      {userWikiUrl && (
                        <a
                          href={userWikiUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="external-link"
                          aria-label={t('summary.links.wikipedia')}
                        >
                          <span className="external-link__icon" aria-hidden="true">
                            <svg viewBox="0 0 24 24" role="img" focusable="false" aria-hidden="true">
                              <path d="M4 6h3l2.2 7.2L11.8 6h2.4l2.6 7.2L19 6h3l-4.1 12h-2.4L13 10.2 10.5 18H8.1L4 6z" />
                            </svg>
                          </span>
                          <span className="external-link__text">{t('summary.links.wikipedia')}</span>
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
              <div
                className="explanation-content"
                style={explanationMinHeight ? { minHeight: `${explanationMinHeight}px` } : undefined}
              >
                {isLoading ? (
                  <div className="explanation-section__loader">
                    <div className="spinner"></div>
                  </div>
                ) : (
                  <>
                    {explanation && (
                      <Typewriter
                        text={explanation}
                        speed={20}
                        onHeightChange={(height) => {
                          setExplanationMinHeight((prev) => (prev && prev > height ? prev : height));
                        }}
                      />
                    )}
                    {discriminant && (
                      <p className="explanation-discriminant">
                        <span className="discriminant-icon" aria-hidden="true">🔍</span>
                        {discriminant}
                      </p>
                    )}
                    {aiSources.length > 0 && (
                      <p className="explanation-sources">
                        {t('summary.explanation_sources')}{' '}
                        {aiSources.join(', ')}
                      </p>
                    )}
                  </>
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
