import React, { useEffect, useRef, useState } from 'react';
import { useUser } from '../context/UserContext';
import { useGameData } from '../context/GameContext';
import './RoundSummaryModal.css';
import { getSizedImageUrl } from '../utils/imageUtils';
import { useLanguage } from '../context/LanguageContext.jsx';
import { fetchExplanation } from '../services/api';

const supportsLazyLoading =
  typeof HTMLImageElement !== 'undefined' && 'loading' in HTMLImageElement.prototype;

const RoundSummaryModal = ({ status, question, onNext, userAnswer }) => {
  const { t, lang, getTaxonDisplayNames } = useLanguage();
  const { profile } = useUser();
  const [explanation, setExplanation] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const buttonRef = useRef(null);
  const previousActiveRef = useRef(null);
  const isWin = status === 'win';

  useEffect(() => {
    if (!isWin && userAnswer && question?.bonne_reponse) {
      const fetchExplanationAsync = async () => {
        setIsLoading(true);
        try {
          const data = await fetchExplanation(question.bonne_reponse.id, userAnswer.id, lang);
          setExplanation(data.explanation);
        } catch (error) {
          console.error('Failed to fetch explanation:', error);
          setExplanation('');
        } finally {
          setIsLoading(false);
        }
      };
      fetchExplanationAsync();
    }
  }, [isWin, userAnswer, question, lang]);

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

  const { bonne_reponse, inaturalist_url } = question;
  const { primary: primaryName, secondary: secondaryName } = getTaxonDisplayNames(bonne_reponse);
  const imageUrl = bonne_reponse.image_url || (question.image_urls && question.image_urls[0]);
  const wikipediaUrl = bonne_reponse.wikipedia_url;
  const title = isWin ? t('summary.win_title') : t('summary.lose_title');
  const titleIcon = isWin ? '🎉' : '😟';

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
                <div className="answer-image-wrapper">
                  <img
                    src={getSizedImageUrl(bonne_reponse.image_url, 'medium')}
                    srcSet={`${getSizedImageUrl(bonne_reponse.image_url, 'small')} 300w, ${getSizedImageUrl(bonne_reponse.image_url, 'medium')} 600w`}
                    sizes="(max-width: 768px) 120px, 200px"
                    alt={primaryName || secondaryName}
                    className="answer-image"
                    {...(supportsLazyLoading ? { loading: 'lazy' } : {})}
                  />
                </div>
                <div className="answer-details">
                  {primaryName && <p className="answer-name">{primaryName}</p>}
                  {secondaryName && <p className="answer-scientific-name"><em>{secondaryName}</em></p>}
                  <div className="external-links-container modal-links">
                    {bonne_reponse.inaturalist_url && (
                      <a href={bonne_reponse.inaturalist_url} target="_blank" rel="noopener noreferrer" className="external-link">
                        {t('summary.links.inaturalist')}
                      </a>
                    )}
                    {bonne_reponse.wikipedia_url && (
                      <a href={bonne_reponse.wikipedia_url} target="_blank" rel="noopener noreferrer" className="external-link">
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
                  <div className="answer-image-wrapper">
                    <img
                      src={getSizedImageUrl(userAnswer.image_url, 'medium')}
                      srcSet={`${getSizedImageUrl(userAnswer.image_url, 'small')} 300w, ${getSizedImageUrl(userAnswer.image_url, 'medium')} 600w`}
                      sizes="(max-width: 768px) 120px, 200px"
                      alt={userAnswer.primaryName || userAnswer.secondaryName}
                      className="answer-image"
                      {...(supportsLazyLoading ? { loading: 'lazy' } : {})}
                    />
                  </div>
                  <div className="answer-details">
                    {userAnswer.primaryName && <p className="answer-name">{userAnswer.primaryName}</p>}
                    {userAnswer.secondaryName && <p className="answer-scientific-name"><em>{userAnswer.secondaryName}</em></p>}
                    <div className="external-links-container modal-links">
                      {userAnswer.inaturalist_url && (
                        <a href={userAnswer.inaturalist_url} target="_blank" rel="noopener noreferrer" className="external-link">
                          {t('summary.links.inaturalist')}
                        </a>
                      )}
                      {userAnswer.wikipedia_url && (
                        <a href={userAnswer.wikipedia_url} target="_blank" rel="noopener noreferrer" className="external-link">
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
              <h4 className="explanation-section__title">{t('summary.explanation_title')}</h4>
              {isLoading ? (
                <div className="explanation-section__loader">
                  <div className="spinner"></div>
                </div>
              ) : (
                explanation && <p className="explanation-section__text">{explanation}</p>
              )}
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