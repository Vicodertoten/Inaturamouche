import React from 'react';
import { MASTERY_LEVELS } from '../services/CollectionService';
import { getRarityInfoForTaxon } from '../utils/rarityUtils';
import './CollectionCard.css';

// Memoize the component to prevent re-renders in react-window
const CollectionCard = React.memo(({ taxon, collection, style }) => {
  const masteryLevel = collection?.masteryLevel || MASTERY_LEVELS.NONE;
  const isUnseen = masteryLevel === MASTERY_LEVELS.NONE && (!collection || collection.seenCount === 0);
  
  // "Ghost" species: seen but never identified correctly
  const isGhost = collection?.seenCount > 0 && collection?.correctCount === 0;

  const cardClasses = [
    'collection-card',
    `mastery-${masteryLevel}`,
    isGhost ? 'ghost' : '',
    isUnseen ? 'unseen' : '',
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

  // Use localized common name if available, otherwise fall back to English or scientific name
  const displayCommonName = taxon.local_preferred_common_name || taxon.preferred_common_name || taxon.name;

  return (
    <div className={cardClasses} style={style}>
      <div className="card-image-wrapper">
        <img src={imageUrl} alt={taxon.name} className="card-image" loading="lazy" />
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
        <p className="card-common-name">{displayCommonName}</p>
        {masteryLevel > MASTERY_LEVELS.BRONZE && (
          <p className="card-scientific-name">{taxon.name}</p>
        )}
      </div>
    </div>
  );
});

CollectionCard.displayName = 'CollectionCard';

export default CollectionCard;
