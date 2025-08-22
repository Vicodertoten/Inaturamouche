import React, { useState, useRef, useEffect } from 'react';
import './ImageViewer.css';
import { getSizedImageUrl } from '../utils/imageUtils';

// Constante pour le niveau de zoom maximal
const MAX_ZOOM = 2.5;

function ImageViewer({ imageUrls, alt, nextImageUrl }) {
  // --- États du composant ---
  const [currentIndex, setCurrentIndex] = useState(0); // Index de l'image affichée
  const [rotation, setRotation] = useState(0);       // Angle de rotation de l'image
  const [scale, setScale] = useState(1);     // Niveau de zoom courant
  const [transform, setTransform] = useState({ x: 0, y: 0 }); // Position de l'image lors du déplacement (pan)
  const [isLoaded, setIsLoaded] = useState(true); // État de chargement de l'image

  // --- Références pour la gestion du déplacement ---
  const containerRef = useRef(null); // Référence au conteneur pour gérer le style du curseur
  const isPanning = useRef(false);     // Vrai si l'utilisateur est en train de cliquer-glisser
  const didPan = useRef(false);        // Vrai si un déplacement a eu lieu depuis le dernier clic
  const lastPos = useRef({ x: 0, y: 0 }); // Stocke la dernière position du pointeur
  const pointers = useRef(new Map());  // Pointeurs actifs pour le pinch zoom
  const initialPinchDistance = useRef(null);
  const initialScale = useRef(1);

  // --- Effet pour réinitialiser l'état quand les images changent (nouvelle question) ---
  useEffect(() => {
    setCurrentIndex(0);
    setRotation(0);
    setScale(1);
    setTransform({ x: 0, y: 0 });
    setIsLoaded(true);
  }, [imageUrls]);

  // Réinitialise l'état de chargement à chaque changement d'image
  useEffect(() => {
    setIsLoaded(currentIndex === 0);
  }, [currentIndex]);

  // Précharge l'image de la prochaine question si fournie
  useEffect(() => {
    if (!nextImageUrl) return;
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'image';
    link.href = getSizedImageUrl(nextImageUrl, 'large');
    document.head.appendChild(link);
    return () => {
      document.head.removeChild(link);
    };
  }, [nextImageUrl]);

  // --- Fonctions pour les contrôles ---
  const resetViewState = () => {
    setRotation(0);
    setScale(1);
    setTransform({ x: 0, y: 0 });
  };

  const handleNext = () => {
    setCurrentIndex((prevIndex) => (prevIndex + 1) % imageUrls.length);
    resetViewState();
  };

  const handlePrev = () => {
    setCurrentIndex((prevIndex) => (prevIndex - 1 + imageUrls.length) % imageUrls.length);
    resetViewState();
  };

  const handleRotate = () => {
    setRotation((prevRotation) => (prevRotation + 90) % 360);
  };

  // --- Fonctions pour le Zoom et le Déplacement (Pan) ---

  // Gère le clic sur l'image : active/désactive le zoom
  const handleImageClick = () => {
    // Si un déplacement vient d'avoir lieu, on ne déclenche pas le zoom/dézoom.
    if (didPan.current) {
      return;
    }
    if (scale !== 1) {
      // Si on dézoome, on réinitialise la position
      setTransform({ x: 0, y: 0 });
      setScale(1);
    } else {
      setScale(MAX_ZOOM);
    }
  };

  // Gestion des événements pointeur pour le pan et le pinch
  const handlePointerDown = (e) => {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.current.size === 1 && scale > 1) {
      e.preventDefault();
      isPanning.current = true;
      didPan.current = false;
      lastPos.current = { x: e.clientX, y: e.clientY };
      if (containerRef.current) {
        containerRef.current.style.cursor = 'grabbing';
      }
    }

    if (pointers.current.size === 2) {
      // Début d'un pinch : on stocke la distance initiale
      const [p1, p2] = Array.from(pointers.current.values());
      initialPinchDistance.current = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      initialScale.current = scale;
      didPan.current = true; // Empêche le click de se déclencher
      isPanning.current = false;
    }
  };

  const handlePointerMove = (e) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

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

    if (isPanning.current) {
      didPan.current = true;
      const dx = e.clientX - lastPos.current.x;
      const dy = e.clientY - lastPos.current.y;
      setTransform((prev) => ({
        x: prev.x + dx,
        y: prev.y + dy,
      }));
      lastPos.current = { x: e.clientX, y: e.clientY };
    }
  };

  const endPointer = (e) => {
    pointers.current.delete(e.pointerId);

    if (pointers.current.size < 2) {
      initialPinchDistance.current = null;
    }

    if (pointers.current.size === 0) {
      isPanning.current = false;
      if (containerRef.current) {
        containerRef.current.style.cursor = 'pointer';
      }
    }
  };

  const handlePointerUp = (e) => {
    endPointer(e);
  };

  const handlePointerCancel = (e) => {
    endPointer(e);
  };

  const handlePointerLeave = (e) => {
    endPointer(e);
  };

  // Si pas d'images, on n'affiche rien.
  if (!imageUrls || imageUrls.length === 0) {
    return <div className="image-viewer-container">Chargement...</div>;
  }

  return (
    <div className="image-viewer-container">
      <div
        ref={containerRef}
        className="image-wrapper"
        onClick={handleImageClick}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onPointerLeave={handlePointerLeave}
      >
        <img
          src={getSizedImageUrl(imageUrls[currentIndex], 'large')}
          srcSet={`${getSizedImageUrl(imageUrls[currentIndex], 'small')} 300w, ${getSizedImageUrl(imageUrls[currentIndex], 'medium')} 600w, ${getSizedImageUrl(imageUrls[currentIndex], 'large')} 1024w`}
          sizes="(max-width: 600px) 100vw, 600px"
          alt={alt}
          loading="lazy"
          decoding={currentIndex === 0 ? 'async' : undefined}
          fetchpriority={currentIndex === 0 ? 'high' : undefined}
          onLoad={() => setIsLoaded(true)}
          style={{
            transform: `translateX(${transform.x}px) translateY(${transform.y}px) scale(${scale}) rotate(${rotation}deg)`,
            transition:
              isPanning.current || initialPinchDistance.current
                ? 'none'
                : 'transform 0.3s ease', // Désactive la transition pendant le déplacement ou le pinch
          }}
          draggable="false"
        />
        {!isLoaded && currentIndex !== 0 && (
          <div className="image-placeholder" />
        )}
      </div>
      <div className="image-controls">
        <button onClick={handlePrev} disabled={imageUrls.length <= 1}>‹</button>
        <span>{currentIndex + 1} / {imageUrls.length}</span>
        <button onClick={handleNext} disabled={imageUrls.length <= 1}>›</button>
        <button onClick={handleRotate} className="rotate-btn" title="Pivoter l'image">↻</button>
      </div>
    </div>
  );
}

export default ImageViewer;
