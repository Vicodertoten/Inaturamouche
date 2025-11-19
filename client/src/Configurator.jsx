import React from 'react';
import PACKS from '../../shared/packs.js';
import CustomFilter from './CustomFilter';
import ErrorModal from './components/ErrorModal';
import './configurator.css';
import { useGame } from './context/GameContext';

function Configurator({ onStartGame, onStartReview }) {
  const {
    activePackId,
    setActivePackId,
    customFilters,
    dispatchCustomFilters,
    error,
    clearError,
    canStartReview,
  } = useGame();

  // On trouve les détails du pack actuellement sélectionné pour afficher sa description

  // Le gestionnaire pour le changement de sélection dans le menu déroulant
  const handlePackChange = (e) => {
    setActivePackId(e.target.value);
  };

  return (
    <div>
      {error && <ErrorModal message={error} onClose={clearError} />}
      
      <div className="pack-selector">
        <label htmlFor="pack-select">Choisissez un pack de jeu :</label>
        <div
          className="tooltip"
          data-tooltip="Sélectionnez un pack thématique ou personnalisez votre partie"
          onPointerLeave={e => e.currentTarget.querySelector('select')?.blur()}
          title="Sélectionnez un pack thématique ou personnalisez votre partie"
        >
          <select
            id="pack-select"
            value={activePackId}
            onChange={handlePackChange}
            className="pack-select-dropdown"
          >
            {PACKS.map((pack) => (
              <option key={pack.id} value={pack.id}>
                {pack.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="pack-details">
  
        {/* Si le pack "Personnalisé" est actif, on affiche son interface de filtres */}
        {activePackId === 'custom' && (
          <CustomFilter 
            filters={customFilters}
            dispatch={dispatchCustomFilters}
          />
        )}
      </div>

      <button onClick={onStartGame} className="start-button">Lancer la partie !</button>
      {canStartReview && (
        <button onClick={onStartReview} className="start-button">Réviser mes erreurs</button>
      )}
    </div>
  );
}

export default Configurator;
