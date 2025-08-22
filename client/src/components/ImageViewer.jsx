import React, { useState, useRef, useEffect } from 'react';
import './ImageViewer.css';
import { getSizedImageUrl } from '../utils/imageUtils';

// Constante pour le niveau de zoom
const ZOOM_LEVEL = 2.5;

function ImageViewer({ imageUrls, alt }) {
  // --- États du composant ---
  const [currentIndex, setCurrentIndex] = useState(0); // Index de l'image affichée
  const [rotation, setRotation] = useState(0);       // Angle de rotation de l'image
  const [isZoomed, setIsZoomed] = useState(false);     // État de zoom (activé/désactivé)
  const [transform, setTransform] = useState({ x: 0, y: 0 }); // Position de l'image lors du déplacement (pan)

  // --- Références pour la gestion du déplacement ---
  const containerRef = useRef(null); // Référence au conteneur pour gérer le style du curseur
  const isPanning = useRef(false);     // Vrai si l'utilisateur est en train de cliquer-glisser
  const didPan = useRef(false);        // Vrai si un déplacement a eu lieu depuis le dernier clic
  const lastMousePos = useRef({ x: 0, y: 0 }); // Stocke la dernière position de la souris

  // --- Effet pour réinitialiser l'état quand les images changent (nouvelle question) ---
  useEffect(() => {
    setCurrentIndex(0);
    setRotation(0);
    setIsZoomed(false);
    setTransform({ x: 0, y: 0 });
  }, [imageUrls]);

  // --- Fonctions pour les contrôles ---
  const resetViewState = () => {
    setRotation(0);
    setIsZoomed(false);
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
    if (isZoomed) {
      // Si on dézoome, on réinitialise la position
      setTransform({ x: 0, y: 0 });
    }
    setIsZoomed(!isZoomed);
  };

  // Se déclenche quand l'utilisateur appuie sur le bouton de la souris
  const handleMouseDown = (e) => {
    // Le déplacement n'est possible que si l'image est zoomée
    if (!isZoomed) return;

    e.preventDefault();
    isPanning.current = true;
    didPan.current = false; // Réinitialise l'état du déplacement
    lastMousePos.current = { x: e.clientX, y: e.clientY };
    if (containerRef.current) {
      containerRef.current.style.cursor = 'grabbing';
    }
  };

  // Se déclenche quand l'utilisateur déplace la souris
  const handleMouseMove = (e) => {
    if (!isPanning.current) return;

    didPan.current = true; // Un déplacement a eu lieu
    const dx = e.clientX - lastMousePos.current.x;
    const dy = e.clientY - lastMousePos.current.y;

    setTransform((prev) => ({
      x: prev.x + dx,
      y: prev.y + dy,
    }));
    lastMousePos.current = { x: e.clientX, y: e.clientY };
  };

  // Se déclenche quand l'utilisateur relâche le bouton de la souris
  const handleMouseUp = () => {
    isPanning.current = false;
    if (containerRef.current) {
      containerRef.current.style.cursor = 'pointer';
    }
  };

  // Sécurité : si la souris quitte le conteneur, on arrête le déplacement
  const handleMouseLeave = () => {
    if (isPanning.current) {
      handleMouseUp();
    }
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
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      >
        <img
          src={getSizedImageUrl(imageUrls[currentIndex], 'large')}
          srcSet={`${getSizedImageUrl(imageUrls[currentIndex], 'small')} 300w, ${getSizedImageUrl(imageUrls[currentIndex], 'medium')} 600w, ${getSizedImageUrl(imageUrls[currentIndex], 'large')} 1024w`}
          sizes="(max-width: 600px) 100vw, 600px"
          alt={alt}
          loading="lazy"
          style={{
            transform: `translateX(${transform.x}px) translateY(${transform.y}px) scale(${isZoomed ? ZOOM_LEVEL : 1}) rotate(${rotation}deg)`,
            transition: isPanning.current ? 'none' : 'transform 0.3s ease', // Désactive la transition pendant le déplacement pour plus de fluidité
          }}
          draggable="false"
        />
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