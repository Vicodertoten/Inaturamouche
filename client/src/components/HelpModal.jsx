// src/components/HelpModal.jsx

import React, { useEffect } from 'react';
import './HelpModal.css'; // Nous allons créer ce fichier CSS juste après

function HelpModal({ onClose }) {
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

  return (
    // Le fond assombri qui ferme le modal au clic
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      {/* On empêche la propagation du clic pour que le modal ne se ferme pas quand on clique dessus */}
      <div className="modal-content help-modal" tabIndex="-1" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="close-button" title="Fermer" aria-label="Fermer">×</button>
        
        <h2 className="modal-title">Bienvenue sur Inaturaquizz !</h2>
        
        <div className="help-section">
          <h4>Principe du jeu</h4>
          <p>
            Le but est d'identifier des espèces (animaux, plantes, champignons...) à partir d'une photo. 
            Le jeu utilise les données réelles de la plateforme de science participative iNaturalist.
          </p>
        </div>

        <div className="help-section">
          <h4>Modes de jeu</h4>
          <ul>
            <li>
              <strong>Facile :</strong> Un quiz à choix multiples. Idéal pour découvrir de nouvelles espèces de manière détendue.
            </li>
            <li>
              <strong>Difficile :</strong> Le vrai défi ! Vous devez retrouver la classification taxonomique complète de l'espèce (règne, embranchement, classe, etc.). Chaque bonne proposition vous rapproche de la solution.
            </li>
          </ul>
        </div>
        
        <div className="help-section">
          <h4>Packs de jeu</h4>
          <p>
            Choisissez un pack thématique (oiseaux du monde, mammifères de France...) pour concentrer le jeu sur un groupe d'espèces ou une région, ou créez votre propre partie personnalisée !
          </p>
        </div>

        <button onClick={onClose} className="start-button-modal">Compris !</button>
      </div>
    </div>
  );
}

export default HelpModal;
