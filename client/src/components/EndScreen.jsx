import React from 'react';

const EndScreen = ({ score, onRestart }) => (
  <div className="screen end-screen">
    <div className="card">
      <h1>Partie terminée !</h1>
      <h2>Votre score final : <span className="score">{score}</span></h2>
      <button onClick={onRestart} className="start-button">Rejouer</button>
    </div>
  </div>
);

export default EndScreen;