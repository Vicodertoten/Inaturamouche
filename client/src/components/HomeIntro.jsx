// src/components/HomeIntro.jsx

import React from 'react';

function HomeIntro({ onClose }) {
  const handleClose = () => {
    localStorage.setItem('home_intro_seen', '1');
    onClose();
  };

  return (
    <div className="home-intro">
      <p><strong>Principe :</strong> identifiez des espèces à partir de photos issues d'iNaturalist.</p>
      <p><strong>Modes :</strong> Facile (QCM) ou Difficile (classification complète).</p>
      <p><strong>Packs :</strong> choisissez un thème prédéfini ou créez le vôtre.</p>
      <button onClick={handleClose} className="start-button-modal">Compris</button>
    </div>
  );
}

export default HomeIntro;
