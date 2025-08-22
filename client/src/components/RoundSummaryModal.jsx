// src/components/RoundSummaryModal.jsx (version finale corrigée)

import React from 'react';
import './RoundSummaryModal.css';
import { getSizedImageUrl } from '../utils/imageUtils';

const RoundSummaryModal = ({ status, question, scoreInfo, onNext }) => {
  if (!question || !question.bonne_reponse) {
    return null; 
  }

  const { bonne_reponse, inaturalist_url } = question;
  const isWin = status === 'win';

  // --- LA SEULE LIGNE À CHANGER EST CI-DESSOUS ---
  const commonName = bonne_reponse.common_name; // On lit `common_name` au lieu de `preferred_common_name`
  
  const scientificName = bonne_reponse.name;
  const imageUrl = bonne_reponse.image_url || (question.image_urls && question.image_urls[0]);
  const wikipediaUrl = bonne_reponse.wikipedia_url;

  // On vérifie que le nom commun n'est pas simplement une répétition du nom scientifique
  const displayCommonName = commonName && commonName !== scientificName ? commonName : null;

  return (
    <div className="modal-backdrop">
      <div className="modal-content summary-modal">
        <h2 className={isWin ? 'win-title' : 'lose-title'}>
          {isWin ? '🎉 Espèce trouvée !' : '😟 Dommage !'}
        </h2>
        
        <div className="correct-answer-section">
          <p>La réponse était :</p>
          <img
            src={getSizedImageUrl(imageUrl, 'large')}
            srcSet={`${getSizedImageUrl(imageUrl, 'small')} 300w, ${getSizedImageUrl(imageUrl, 'medium')} 600w, ${getSizedImageUrl(imageUrl, 'large')} 1024w`}
            sizes="(max-width: 600px) 100vw, 400px"
            alt={commonName || scientificName}
            className="answer-image"
            loading="lazy"
          />
          
          {/* On affiche le nom commun que s'il existe ET est différent du nom scientifique */}
          {displayCommonName && (
            <h3 className="answer-name">{displayCommonName}</h3>
          )}
          
          <p className="answer-scientific-name"><em>{scientificName}</em></p>
          
          <div className="external-links-container modal-links">
            <a href={inaturalist_url} target="_blank" rel="noopener noreferrer" className="external-link">
              Voir sur iNaturalist
            </a>
            {wikipediaUrl && (
              <a href={wikipediaUrl} target="_blank" rel="noopener noreferrer" className="external-link">
                Page Wikipédia
              </a>
            )}
          </div>
        </div>

        {scoreInfo && (
          <div className="score-section">
            <p>Points gagnés : <span className="score-points">+{scoreInfo.points}</span></p>
            {scoreInfo.bonus > 0 && (
              <p>Bonus : <span className="score-points">+{scoreInfo.bonus}</span></p>
            )}
            <p>Total pour la manche : <span className="score-total">+{scoreInfo.points + (scoreInfo.bonus || 0)}</span></p>
          </div>
        )}
        
        <button onClick={onNext} className="start-button-modal">
          Question Suivante
        </button>
      </div>
    </div>
  );
};

export default RoundSummaryModal;