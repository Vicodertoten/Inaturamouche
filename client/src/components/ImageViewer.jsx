import React, { useState, useRef, useEffect } from 'react';
import './ImageViewer.css';
import { getSizedImageUrl } from '../utils/imageUtils';

// Detect native support for the `loading="lazy"` attribute.
// Fallback: when unsupported (e.g. Safari), the image loads immediately.
const supportsLazyLoading =
  typeof HTMLImageElement !== 'undefined' && 'loading' in HTMLImageElement.prototype;

const MAX_ZOOM = 2.5;

function ImageViewer({ imageUrls, alt, nextImageUrl }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [scale, setScale] = useState(1);
  const [transform, setTransform] = useState({ x: 0, y: 0 });
  const [isLoaded, setIsLoaded] = useState(true);
  const [aspectRatio, setAspectRatio] = useState();
  const [isPortrait, setIsPortrait] = useState(false);

  const containerRef = useRef(null);
  const isPanning = useRef(false);
  const didPan = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });
  const pointers = useRef(new Map());
  const initialPinchDistance = useRef(null);
  const initialScale = useRef(1);

  // Reset quand la liste change
  useEffect(() => {
    setCurrentIndex(0);
    setScale(1);
    setTransform({ x: 0, y: 0 });
    setIsLoaded(true);
    setIsPortrait(false);
  }, [imageUrls]);

  // Placeholder pendant le chargement des images > 0
  useEffect(() => {
    setIsLoaded(currentIndex === 0);
  }, [currentIndex]);

  // Prefetch de la prochaine image si fourni
  useEffect(() => {
    if (!nextImageUrl) return;
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.href = getSizedImageUrl(nextImageUrl, 'medium');
    document.head.appendChild(link);
    return () => {
      document.head.removeChild(link);
    };
  }, [nextImageUrl]);

  const resetViewState = () => {
    setScale(1);
    setTransform({ x: 0, y: 0 });
  };

  const handleNext = () => {
    if (!imageUrls?.length) return;
    setCurrentIndex((prev) => (prev + 1) % imageUrls.length);
    resetViewState();
  };

  const handlePrev = () => {
    if (!imageUrls?.length) return;
    setCurrentIndex((prev) => (prev - 1 + imageUrls.length) % imageUrls.length);
    resetViewState();
  };

  const handleImageClick = () => {
    if (didPan.current) return;
    if (scale !== 1) {
      setTransform({ x: 0, y: 0 });
      setScale(1);
    } else {
      setScale(MAX_ZOOM);
    }
  };

  const handlePointerDown = (e) => {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    // Panning si zoomé
    if (pointers.current.size === 1 && scale > 1) {
      e.preventDefault();
      isPanning.current = true;
      didPan.current = false;
      lastPos.current = { x: e.clientX, y: e.clientY };
      if (containerRef.current) containerRef.current.style.cursor = 'grabbing';
    }

    // Pinch zoom
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

    // Pinch
    if (pointers.current.size === 2 && initialPinchDistance.current) {
      const [p1, p2] = Array.from(pointers.current.values());
      const distance = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      const newScale = Math.min(
        MAX_ZOOM,
        Math.max(1, (initialScale.current * distance) / initialPinchDistance.current)
      );
      setScale(newScale);
      return;
    }

    // Pan
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
      if (containerRef.current) containerRef.current.style.cursor = 'pointer';
    }
  };

  const handlePointerUp = endPointer;
  const handlePointerCancel = endPointer;
  const handlePointerLeave = endPointer;

  const handleImageLoad = (e) => {
    setIsLoaded(true);
    const { naturalWidth, naturalHeight } = e.target;
    if (naturalWidth && naturalHeight) {
      setAspectRatio(`${naturalWidth} / ${naturalHeight}`);
      setIsPortrait(naturalHeight > naturalWidth);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); handleNext(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); handlePrev(); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleImageClick(); }
  };

  if (!imageUrls || imageUrls.length === 0) {
    return <div className="image-viewer-container">Chargement...</div>;
  }

  const currentUrl = imageUrls[currentIndex];

  return (
    <div className="image-viewer-container">
      <div
        ref={containerRef}
        className={`image-wrapper ${isPortrait ? 'portrait' : ''}`}
        style={{ touchAction: scale > 1 ? 'none' : 'pan-y', cursor: 'pointer' }}
        onClick={handleImageClick}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onPointerLeave={handlePointerLeave}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="group"
        aria-roledescription="Visionneuse d'images"
        aria-label={alt}
      >
        <div className="image-box" style={{ position: 'relative' }}>
          <img
            src={getSizedImageUrl(currentUrl, 'medium')}
            srcSet={`${getSizedImageUrl(currentUrl, 'small')} 300w, ${getSizedImageUrl(currentUrl, 'medium')} 600w`}
            sizes="(max-width: 600px) 100vw, 600px"
            alt={alt}
            {...(supportsLazyLoading ? { loading: 'lazy' } : {})}
            decoding={currentIndex === 0 ? 'async' : undefined}
            fetchPriority={currentIndex === 0 ? 'high' : undefined}
            onLoad={handleImageLoad}
            style={{
              width: '100%',
              maxHeight: '50vh',
              aspectRatio,
              transform: `translate(${transform.x}px, ${transform.y}px) scale(${scale})`,
              transition: (isPanning.current || initialPinchDistance.current) ? 'none' : 'transform 0.3s ease',
              display: 'block',
              userSelect: 'none'
            }}
            draggable={false}
            onContextMenu={(e) => e.preventDefault()}
          />

          {!isLoaded && currentIndex !== 0 && <div className="image-placeholder" aria-hidden="true" />}

          {imageUrls.length > 1 && (
            <div className="nav-overlay" role="group" aria-label="Contrôles de navigation">
              <button
                type="button"
                className="nav-button prev"
                aria-label="Image précédente"
                onClick={(e) => { e.stopPropagation(); handlePrev(); }}
              />
              <div className="dots" role="tablist" aria-label="Choix de l'image">
                {imageUrls.map((_, idx) => (
                  <button
                    key={idx}
                    type="button"
                    role="tab"
                    aria-label={`Aller à l'image ${idx + 1}`}
                    className={`dot ${idx === currentIndex ? 'active' : ''}`}
                    aria-selected={idx === currentIndex}
                    onClick={(e) => { e.stopPropagation(); setCurrentIndex(idx); resetViewState(); }}
                  />
                ))}
              </div>
              <button
                type="button"
                className="nav-button next"
                aria-label="Image suivante"
                onClick={(e) => { e.stopPropagation(); handleNext(); }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ImageViewer;
