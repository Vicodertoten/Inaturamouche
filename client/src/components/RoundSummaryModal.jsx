// src/components/RoundSummaryModal.jsx (mis à jour)

import React from 'react';
import './RoundSummaryModal.css';

const RoundSummaryModal = ({ status, question, scoreInfo, onNext }) => {
  const { bonne_reponse } = question;
  const isWin = status === 'win';

  return (
    <div className="modal-backdrop">
      <div className="modal-content summary-modal">
        <h2 className={isWin ? 'win-title' : 'lose-title'}>
          {isWin ? '🎉 Espèce trouvée !' : '😟 Dommage !'}
        </h2>
        
        <div className="correct-answer-section">
          <p>La réponse était :</p>
          <img src={bonne_reponse.image_url || question.image_urls[0]} alt={bonne_reponse.name} className="answer-image" />
          <h3 className="answer-name">{bonne_reponse.preferred_common_name || bonne_reponse.name}</h3>
          <p className="answer-scientific-name"><em>{bonne_reponse.name}</em></p>
          
          {/* --- NOUVEAU : Ajout des liens externes ici --- */}
          <div className="external-links-container modal-links">
            <a href={question.inaturalist_url} target="_blank" rel="noopener noreferrer" className="external-link">
              Voir sur iNaturalist
            </a>
            {bonne_reponse.wikipedia_url && (
              <a href={bonne_reponse.wikipedia_url} target="_blank" rel="noopener noreferrer" className="external-link">
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