import React, { useState, useRef, useEffect, useMemo } from 'react';
import './ImageViewer.css';
import { getSizedImageUrl } from '../utils/imageUtils';
import { useLanguage } from '../context/LanguageContext.jsx';

const supportsLazyLoading =
  typeof HTMLImageElement !== 'undefined' && 'loading' in HTMLImageElement.prototype;

const BASE_MAX_ZOOM = 2.5;

function ImageViewer({ imageUrls, alt, photoMeta = [] }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [scale, setScale] = useState(1);
  const [transform, setTransform] = useState({ x: 0, y: 0 });
  const [isHighResLoaded, setIsHighResLoaded] = useState(false);
  const [isLowResLoaded, setIsLowResLoaded] = useState(false);
  // On supprime l'aspectRatio dynamique qui faisait sauter le layout
  // On garde isPortrait pour potentiellement ajuster le conteneur, mais c'est optionnel
  const [isPortrait, setIsPortrait] = useState(false);
  const [maxZoom, setMaxZoom] = useState(BASE_MAX_ZOOM);
  
  const containerRef = useRef(null);
  const isPanning = useRef(false);
  const didPan = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });
  const pointers = useRef(new Map());
  const initialPinchDistance = useRef(null);
  const initialScale = useRef(1);
  const { t } = useLanguage();

  useEffect(() => {
    setCurrentIndex(0);
    setScale(1);
    setTransform({ x: 0, y: 0 });
    setIsHighResLoaded(false);
    setIsLowResLoaded(false);
    setIsPortrait(false);
    setMaxZoom(BASE_MAX_ZOOM);
  }, [imageUrls]);

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % imageUrls.length);
    resetZoom();
  };
  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + imageUrls.length) % imageUrls.length);
    resetZoom();
  };

  const resetZoom = () => {
    setTransform({ x: 0, y: 0 });
    setScale(1);
    setIsHighResLoaded(false); // Reset loading state for transition
  };

  const handleImageClick = () => {
    if (didPan.current) return;
    if (scale !== 1) {
      setTransform({ x: 0, y: 0 });
      setScale(1);
    } else {
      setScale(maxZoom);
    }
  };

  // ... Pointer handlers (keep existing logic) ...
  const handlePointerDown = (e) => {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 1 && scale > 1) {
      e.preventDefault();
      isPanning.current = true;
      didPan.current = false;
      lastPos.current = { x: e.clientX, y: e.clientY };
      if (containerRef.current) containerRef.current.style.cursor = 'grabbing';
    }
    if (pointers.current.size === 2) {
      const [p1, p2] = Array.from(pointers.current.values());
      initialPinchDistance.current = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      initialScale.current = scale;
      didPan.current = true;
      isPanning.current = false;
    }
  };

  const handlePointerMove = (e) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.current.size === 2 && initialPinchDistance.current) {
      const [p1, p2] = Array.from(pointers.current.values());
      const distance = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      const newScale = Math.min(maxZoom, Math.max(1, (initialScale.current * distance) / initialPinchDistance.current));
      setScale(newScale);
      return;
    }

    if (isPanning.current) {
      didPan.current = true;
      const dx = e.clientX - lastPos.current.x;
      const dy = e.clientY - lastPos.current.y;
      setTransform((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
      lastPos.current = { x: e.clientX, y: e.clientY };
    }
  };

  const endPointer = (e) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) initialPinchDistance.current = null;
    if (pointers.current.size === 0) {
      isPanning.current = false;
      if (containerRef.current) containerRef.current.style.cursor = scale > 1 ? 'grab' : 'default';
    }
  };

  const handleImageLoad = (e) => {
    setIsHighResLoaded(true);
    const { naturalWidth, naturalHeight } = e.target;
    if (naturalWidth && naturalHeight) {
      setIsPortrait(naturalHeight > naturalWidth);
      // Calcul du max zoom basé sur la résolution réelle vs affichée
      const containerWidth = containerRef.current?.clientWidth || naturalWidth;
      const zoomRatio = naturalWidth / containerWidth;
      // On permet de zoomer au moins jusqu'à la taille réelle, ou x2.5 min
      const computedMax = Math.min(6, Math.max(BASE_MAX_ZOOM, zoomRatio));
      setMaxZoom(computedMax);
    }
  };

  const hasImages = Array.isArray(imageUrls) && imageUrls.length > 0;
  
  const currentMeta = useMemo(() => photoMeta?.[currentIndex] || null, [photoMeta, currentIndex]);
  const lowResUrl = useMemo(() => hasImages ? getSizedImageUrl(imageUrls[currentIndex], 'small') : null, [imageUrls, currentIndex, hasImages]);
  // Medium (~500px) pour chargement rapide mobile, large pour zoom uniquement
  const mediumUrl = useMemo(() => hasImages ? getSizedImageUrl(imageUrls[currentIndex], 'medium') : null, [imageUrls, currentIndex, hasImages]);
  const largeUrl = useMemo(() => hasImages ? getSizedImageUrl(imageUrls[currentIndex], 'large') : null, [imageUrls, currentIndex, hasImages]);

  // When the effective high-res URL changes (e.g. resume from pause), reset loading states
  useEffect(() => {
    setIsLowResLoaded(false);
    setIsHighResLoaded(false);
  }, [mediumUrl, largeUrl]);

  if (!hasImages) return <div className="image-viewer-container">{t('imageViewer.loading')}</div>;

  return (
    <div className="image-viewer-container">
      <div
        ref={containerRef}
        className={`image-wrapper ${isPortrait ? 'portrait' : ''}`}
        // Handlers sur le wrapper pour capturer les gestes même hors de l'image
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
        onPointerLeave={endPointer}
        onClick={handleImageClick}
        onContextMenu={(e) => e.preventDefault()}
      >
        {/* L'IMAGE (Zoomable Content) */}
        <div className={`image-box ${isHighResLoaded ? 'loaded' : ''}`}>
          <img
            loading={supportsLazyLoading ? 'lazy' : undefined}
            className={`image-lqip ${isLowResLoaded ? 'is-ready' : ''} ${isHighResLoaded ? 'is-hidden' : ''}`}
            src={lowResUrl}
            key={`lqip-${currentIndex}`}
            onLoad={() => setIsLowResLoaded(true)}
            alt=""
            draggable={false}
            onContextMenu={(e) => e.preventDefault()}
          />
          <img
            loading={supportsLazyLoading ? 'eager' : undefined}
            className={`image-main ${isHighResLoaded ? 'is-loaded' : ''}`}
            src={mediumUrl}
            srcSet={`${mediumUrl} 1x, ${largeUrl} 2x`}
            sizes="100vw"
            alt={alt}
            onLoad={handleImageLoad}
            key={`main-${currentIndex}`}
            draggable={false}
            style={{
              transform: `translate(${transform.x}px, ${transform.y}px) scale(${scale})`,
              cursor: scale > 1 ? (isPanning.current ? 'grabbing' : 'grab') : 'zoom-in'
            }}
            onContextMenu={(e) => e.preventDefault()}
            decoding="async"
            onError={(e) => {
              try {
                const target = e.target;
                const current = target.getAttribute('src');
                // Fallback to large if medium fails
                if (largeUrl && current !== largeUrl) target.setAttribute('src', largeUrl);
              } catch (err) {
                // ignore
              }
            }}
          />
        </div>

        {/* NAVIGATION (Fixed Overlay) - Sortie de image-box pour ne pas zoomer */}
        {imageUrls.length > 1 && (
          <div className="nav-overlay" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="nav-button prev"
              onClick={(e) => { e.stopPropagation(); handlePrev(); }}
              aria-label={t('imageViewer.previous')}
            >
              ‹
            </button>

            <button
              type="button"
              className="nav-button next"
              onClick={(e) => { e.stopPropagation(); handleNext(); }}
              aria-label={t('imageViewer.next')}
            >
              ›
            </button>
            
            <div className="dots">
               {imageUrls.map((_, idx) => (
                  <button
                    type="button"
                    key={idx}
                    className={`dot ${idx === currentIndex ? 'active' : ''}`}
                    onClick={(e) => { e.stopPropagation(); setCurrentIndex(idx); resetZoom(); }}
                    aria-label={t('imageViewer.go_to_image', { index: idx + 1 }, `Voir l'image ${idx + 1}`)}
                  />
               ))}
            </div>
          </div>
        )}
      </div>

      {currentMeta && (
        <div className="photo-meta">
          © {currentMeta.attribution || t('imageViewer.meta_unknown')}
        </div>
      )}
    </div>
  );
}

export default ImageViewer;
