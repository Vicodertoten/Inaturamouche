import React, { useEffect, useMemo, useState } from 'react';
import { MASTERY_LEVELS } from '../services/CollectionService';
import { getRarityInfoForTaxon } from '../utils/rarityUtils';
import { buildResponsiveSrcSet, getTaxonResponsiveImageUrls } from '../utils/imageUtils';
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

  const imageUrls = useMemo(() => getTaxonResponsiveImageUrls(taxon), [taxon]);
  const [imgSrc, setImgSrc] = useState(imageUrls.medium || imageUrls.small || imageUrls.square || '');
  const srcSet = useMemo(() => buildResponsiveSrcSet(imageUrls, true), [imageUrls]);
  const sizes = '(max-width: 480px) 50vw, (max-width: 768px) 33vw, (max-width: 1200px) 20vw, 220px';

  useEffect(() => {
    setImgSrc(imageUrls.medium || imageUrls.small || imageUrls.square || '');
  }, [imageUrls.medium, imageUrls.small, imageUrls.square]);

  const handleImageError = () => {
    if (imgSrc !== imageUrls.large && imageUrls.large) {
      setImgSrc(imageUrls.large);
      return;
    }
    if (imgSrc !== imageUrls.original && imageUrls.original) {
      setImgSrc(imageUrls.original);
    }
  };

  // Use localized common name if available, otherwise fall back to English or scientific name
  const displayCommonName = taxon.local_preferred_common_name || taxon.preferred_common_name || taxon.name;

  return (
    <div className={cardClasses} style={style}>
      <div className="card-image-wrapper">
        <img
          src={imgSrc}
          srcSet={srcSet || undefined}
          sizes={srcSet ? sizes : undefined}
          alt={taxon.name}
          className="card-image"
          loading="lazy"
          decoding="async"
          onError={handleImageError}
        />
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
