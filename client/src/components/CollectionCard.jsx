import React from 'react';
import { MASTERY_LEVELS } from '../services/CollectionService';
import { getRarityInfoForTaxon } from '../utils/rarityUtils';
import './CollectionCard.css';

// Memoize the component to prevent re-renders in react-window
const CollectionCard = React.memo(({ taxon, collection, style }) => {
  const masteryLevel = collection?.masteryLevel || MASTERY_LEVELS.NONE;
  
  // "Ghost" species: seen but never identified correctly
  const isGhost = collection?.seenCount > 0 && collection?.correctCount === 0;

  const cardClasses = [
    'collection-card',
    `mastery-${masteryLevel}`,
    isGhost ? 'ghost' : '',
  ].filter(Boolean).join(' ');

  const imageClasses = [
    'card-image',
    isGhost ? 'grayscale' : '',
  ].filter(Boolean).join(' ');

  const rarityInfo = getRarityInfoForTaxon(taxon);

  // Extract best image URL
  const imageUrl =
    taxon?.medium_url ||
    taxon?.picture_url_medium ||
    taxon?.small_url ||
    taxon?.picture_url_small ||
    taxon?.square_url ||
    taxon?.thumbnail ||
    taxon?.default_photo?.medium_url ||
    taxon?.default_photo?.small_url ||
    taxon?.default_photo?.square_url ||
    taxon?.default_photo?.url ||
    '';

  return (
    <div className={cardClasses} style={style}>
      <div className="card-image-wrapper">
        <img src={imageUrl} alt={taxon.name} className={imageClasses} loading="lazy" />
        {rarityInfo?.tier && rarityInfo.tier !== 'unknown' && (
          <span
            className={`rarity-badge rarity-${rarityInfo.tier}`}
            title={`${rarityInfo.label}${rarityInfo.observationsCount ? ` • ${rarityInfo.observationsCount.toLocaleString()} obs.` : ''}`}
          >
            {rarityInfo.label}
          </span>
        )}
      </div>
      <div className="card-info">
        <p className="card-common-name">{taxon.preferred_common_name || taxon.name}</p>
        {masteryLevel > MASTERY_LEVELS.BRONZE && (
          <p className="card-scientific-name">{taxon.name}</p>
        )}
      </div>
    </div>
  );
});

CollectionCard.displayName = 'CollectionCard';

export default CollectionCard;
