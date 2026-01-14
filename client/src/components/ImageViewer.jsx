import React, { useState, useRef, useEffect, useMemo } from 'react';
import './ImageViewer.css';
import { getSizedImageUrl } from '../utils/imageUtils';
import { useLanguage } from '../context/LanguageContext.jsx';

// Detect native support for the `loading="lazy"` attribute.
// Fallback: when unsupported (e.g. Safari), the image loads immediately.
// An IntersectionObserver could be used here instead to emulate lazy loading.
const supportsLazyLoading =
  typeof HTMLImageElement !== 'undefined' && 'loading' in HTMLImageElement.prototype;

const BASE_MAX_ZOOM = 2.5;



function ImageViewer({ imageUrls, alt, nextImageUrl, photoMeta = [] }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [scale, setScale] = useState(1);
  const [transform, setTransform] = useState({ x: 0, y: 0 });
  const [isHighResLoaded, setIsHighResLoaded] = useState(false);
  const [isLowResLoaded, setIsLowResLoaded] = useState(false);
  const [aspectRatio, setAspectRatio] = useState('4 / 3');
  const [isPortrait, setIsPortrait] = useState(false);
  const [maxZoom, setMaxZoom] = useState(BASE_MAX_ZOOM);
  const containerRef = useRef(null);
  const imageBoxRef = useRef(null);
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

  useEffect(() => {
    setIsHighResLoaded(false);
    setIsLowResLoaded(false);
    setAspectRatio(undefined);
    setIsPortrait(false);
  }, [currentIndex]);

  useEffect(() => {
    if (!nextImageUrl) return;
    const preloadImg = new Image();
    preloadImg.src = getSizedImageUrl(nextImageUrl, 'medium');
    return () => {
      preloadImg.src = '';
    };
  }, [nextImageUrl]);

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % imageUrls.length);
    setTransform({ x: 0, y: 0 });
  };
  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + imageUrls.length) % imageUrls.length);
    setTransform({ x: 0, y: 0 });
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
      if (containerRef.current) containerRef.current.style.cursor = 'pointer';
    }
  };

  const handlePointerUp = endPointer;
  const handlePointerCancel = endPointer;
  const handlePointerLeave = endPointer;

  const handleImageLoad = (e) => {
    setIsHighResLoaded(true);
    const { naturalWidth, naturalHeight } = e.target;
    if (naturalWidth && naturalHeight) {
      setAspectRatio(`${naturalWidth} / ${naturalHeight}`);
      setIsPortrait(naturalHeight > naturalWidth);
      const containerWidth = containerRef.current?.clientWidth || naturalWidth;
      const zoomRatio = naturalWidth / containerWidth;
      const computedMax = Math.min(6, Math.max(BASE_MAX_ZOOM, zoomRatio));
      setMaxZoom(computedMax);
    }
  };
  const handleLowResLoad = () => {
    setIsLowResLoaded(true);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); handleNext(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); handlePrev(); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleImageClick(); }
  };

  const hasImages = Array.isArray(imageUrls) && imageUrls.length > 0;

  const currentMeta = useMemo(() => {
    if (!hasImages || !photoMeta || !photoMeta.length) return null;
    return photoMeta[currentIndex] || null;
  }, [hasImages, photoMeta, currentIndex]);

  const lowResUrl = useMemo(() => {
    if (!hasImages) return null;
    return getSizedImageUrl(imageUrls[currentIndex], 'small');
  }, [hasImages, imageUrls, currentIndex]);

  const highResUrl = useMemo(() => {
    if (!hasImages) return null;
    return getSizedImageUrl(imageUrls[currentIndex], 'medium');
  }, [hasImages, imageUrls, currentIndex]);

  if (!hasImages) {
    return <div className="image-viewer-container">{t('imageViewer.loading')}</div>;
  }

  return (
    <div className="image-viewer-container">
      <div
        ref={containerRef}
        className={`image-wrapper ${isPortrait ? 'portrait' : ''}`}
        style={{ touchAction: scale > 1 ? 'none' : 'pan-y' }}
        onClick={handleImageClick}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onPointerLeave={handlePointerLeave}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="group"
        aria-roledescription={t('imageViewer.viewer_label')}
        aria-label={alt}
      >
        {/* NOUVEAU CONTENEUR QUI ÉPOUSE LA PHOTO */}
        <div className="image-box" style={{ position: 'relative' }} ref={imageBoxRef}>
          <img
            className={`image-lqip ${isLowResLoaded ? 'is-ready' : ''} ${isHighResLoaded ? 'is-hidden' : ''}`}
            src={lowResUrl}
            alt=""
            aria-hidden="true"
            onLoad={handleLowResLoad}
            draggable={false}
          />
          <img
            className={`image-main ${isHighResLoaded ? 'is-loaded' : ''}`}
            src={highResUrl}
            srcSet={`${lowResUrl} 300w, ${highResUrl} 600w`}
            sizes="(max-width: 600px) 100vw, 600px"
            alt={alt}
            {...(supportsLazyLoading ? { loading: 'lazy' } : {})}
            decoding={currentIndex === 0 ? 'async' : undefined}
            fetchPriority={currentIndex === 0 ? 'high' : undefined}
            onLoad={handleImageLoad}
            style={{
              width: '100%',
              maxHeight: 'min(60dvh, 100%)',
              aspectRatio,
              transform: `translateX(${transform.x}px) translateY(${transform.y}px) scale(${scale})`,
              transition: (isPanning.current || initialPinchDistance.current)
                ? 'opacity 0.3s ease'
                : 'opacity 0.3s ease, transform 0.3s ease',
              display: 'block' // évite le whitespace inline
            }}
            draggable={false}
          />

          {!isLowResLoaded && !isHighResLoaded && <div className="image-placeholder" />}

          {imageUrls.length > 1 && (
            <div
              className="nav-overlay"
              role="group"
              aria-label={t('imageViewer.nav_label')}
            >
              <button
                type="button"
                className="nav-button prev"
                aria-label={t('imageViewer.previous')}
                onClick={(e) => { e.stopPropagation(); handlePrev(); }}
              >
                ‹
              </button>

              <div className="dots" role="tablist" aria-label={t('imageViewer.choose_image')}>
                {imageUrls.map((_, idx) => (
                  <button
                    key={idx}
                    type="button"
                    aria-label={t('imageViewer.go_to_image', { index: idx + 1 })}
                    className={`dot ${idx === currentIndex ? 'active' : ''}`}
                    aria-selected={idx === currentIndex}
                    onClick={(e) => {
                      e.stopPropagation();
                      setCurrentIndex(idx);
                      setTransform({ x: 0, y: 0 });
                    }}
                  />
                ))}
              </div>

              <button
                type="button"
                className="nav-button next"
                aria-label={t('imageViewer.next')}
                onClick={(e) => { e.stopPropagation(); handleNext(); }}
              >
                ›
              </button>
            </div>
          )}
        </div>
      </div>
      {currentMeta && (
        <div className="photo-meta">
          <span className="photo-meta-credit">
            {currentMeta.attribution || t('imageViewer.meta_unknown')}
          </span>
        </div>
      )}
    </div>
  );
}

export default ImageViewer;
