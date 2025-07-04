import React from 'react';
import { PACKS } from './packs';
import CustomFilter from './CustomFilter';

function Configurator({ onStartGame, error, activePackId, setActivePackId, customFilters, dispatch }) {

  // On trouve les détails du pack actuellement sélectionné pour afficher sa description

  // Le gestionnaire pour le changement de sélection dans le menu déroulant
  const handlePackChange = (e) => {
    setActivePackId(e.target.value);
  };

  return (
    <div>
      {error && <p className="error-message">Erreur : {error}</p>}
      
      <div className="pack-selector">
        {/* --- MODIFICATION ICI --- */}
        {/* On remplace les boutons par un menu déroulant */}
        <label htmlFor="pack-select">Choisissez un pack de jeu :</label>
        <select id="pack-select" value={activePackId} onChange={handlePackChange} className="pack-select-dropdown">
          {PACKS.map(pack => (
            <option key={pack.id} value={pack.id}>
              {pack.title}
            </option>
          ))}
        </select>
      </div>

      <div className="pack-details">
  
        {/* Si le pack "Personnalisé" est actif, on affiche son interface de filtres */}
        {activePackId === 'custom' && (
          <CustomFilter 
            filters={customFilters}
            dispatch={dispatch}
          />
        )}
      </div>

      <button onClick={onStartGame} className="start-button">Lancer la partie !</button>
    </div>
  );
}

export default Configurator;