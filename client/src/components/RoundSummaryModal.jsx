import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import './RoundSummaryModal.css';
import { getSizedImageUrl } from '../utils/imageUtils';
import { toSafeHttpUrl } from '../utils/mediaUtils';
import { useLanguage } from '../context/LanguageContext.jsx';
import { fetchExplanation, getTaxonDetails } from '../services/api';

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
  const { t, lang, getTaxonDisplayNames } = useLanguage();
  const [explanation, setExplanation] = useState('');
  const [discriminant, setDiscriminant] = useState('');
  const [aiSources, setAiSources] = useState([]);
  const [aiConfidence, setAiConfidence] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
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
            setAiConfidence(data.confidence ?? null);
          }
        } catch (error) {
          console.error('Failed to fetch explanation:', error);
          if (isActive) {
            setExplanation('');
            setDiscriminant('');
            setAiSources([]);
            setAiConfidence(null);
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
      <div className="modal-content summary-modal" role="dialog" aria-modal="true" aria-labelledby="summary-title">
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
                        <a href={userDisplayTaxon.inaturalist_url} target="_blank" rel="noopener noreferrer" className="external-link">
                          {t('summary.links.inaturalist')}
                        </a>
                      )}
                      {userWikiUrl && (
                        <a href={userWikiUrl} target="_blank" rel="noopener noreferrer" className="external-link">
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
              {/* Header avec Avatar Papy Mouche */}
              <div className="explanation-header">
                <div className="prof-mouche-avatar" aria-hidden="true">
                  🪰
                </div>
                <span className="explanation-persona-name">{t('summary.explanation_title')}</span>
                <div className="explanation-bubble-tip"></div>
              </div>
              
              <div className="explanation-content">
                {isLoading ? (
                  <div className="explanation-section__loader">
                    <div className="spinner"></div>
                  </div>
                ) : (
                  <>
                    {explanation && <Typewriter text={explanation} speed={20} />}
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
