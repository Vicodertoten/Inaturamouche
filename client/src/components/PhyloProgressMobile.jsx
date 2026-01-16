import React from 'react';
import './PhyloProgressMobile.css';

const RANKS = ['kingdom', 'phylum', 'class', 'order', 'family', 'genus', 'species'];
const RANK_LABELS = {
  kingdom: 'Règne',
  phylum: 'Phylum',
  class: 'Classe',
  order: 'Ordre',
  family: 'Famille',
  genus: 'Genre',
  species: 'Espèce',
};

/**
 * Compact phylogenetic progression indicator for mobile (Hard Mode).
 * Shows taxonomic ranks with checkmarks for discovered ranks.
 * Replaces the full tree view on mobile devices.
 * 
 * @param {Object} props
 * @param {Object} props.discoveredTaxa - Map of discovered taxa by rank
 * @param {string} props.currentRank - Current taxonomic rank being guessed
 */
const PhyloProgressMobile = ({ discoveredTaxa = {}, currentRank = '' }) => {
  // Determine which ranks have been discovered
  const isRankDiscovered = (rank) => {
    if (!discoveredTaxa) return false;
    return discoveredTaxa[rank] && discoveredTaxa[rank].length > 0;
  };
  
  // Get the index of current rank for highlighting
  const currentRankIndex = RANKS.indexOf(currentRank);
  
  return (
    <div className="phylo-progress-mobile" role="status" aria-label="Progression taxonomique">
      <div className="phylo-track">
        {RANKS.map((rank, index) => {
          const discovered = isRankDiscovered(rank);
          const isCurrent = index === currentRankIndex;
          const isPast = index < currentRankIndex;
          
          return (
            <div 
              key={rank}
              className={`phylo-step ${discovered ? 'discovered' : ''} ${isCurrent ? 'current' : ''} ${isPast ? 'past' : ''}`}
              title={RANK_LABELS[rank]}
            >
              <div className="phylo-dot">
                {discovered ? '✓' : '○'}
              </div>
              <div className="phylo-label">
                {RANK_LABELS[rank].slice(0, 3)}
              </div>
              {index < RANKS.length - 1 && (
                <div className={`phylo-connector ${discovered ? 'active' : ''}`} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PhyloProgressMobile;
