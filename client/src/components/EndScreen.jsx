import React from 'react';
import { ACHIEVEMENTS } from '../achievements';

const EndScreen = ({
  score,
  sessionStats,
  sessionSpeciesData = [],
  newlyUnlocked = [],
  onRestart,
  onReturnHome,
}) => {
  const totalQuestions = sessionStats?.totalQuestions || 5;
  const accuracy = ((sessionStats?.correctAnswers || 0) / totalQuestions) * 100;

  return (
    <div className="screen end-screen">
      <div className="card">
        <h1>Partie terminée !</h1>
        <h2>
          Votre score final : <span className="score">{score}</span>
        </h2>
        <p>Précision : {accuracy.toFixed(0)}%</p>
        {sessionSpeciesData.length > 0 && (
          <div className="played-species">
            <h3>Espèces rencontrées :</h3>
            <ul className="species-list">
              {sessionSpeciesData.map((sp, index) => {
                const displayCommon = sp.common_name && sp.common_name !== sp.name ? sp.common_name : null;
                const isCorrect = sp.wasCorrect;
                return (
                  <li key={`${sp.id}-${index}`} className="species-item">
                    <div className="species-info">
                      <div className="species-names">
                        {displayCommon && <span className="species-common">{displayCommon}</span>}
                        <em>{sp.name}</em>
                      </div>
                      <span className={`species-status ${isCorrect ? 'correct' : 'incorrect'}`}>
                        {isCorrect ? '✅' : '❌'}
                      </span>
                    </div>
                    <div className="external-links-container">
                      <a
                        href={sp.inaturalist_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="external-link"
                      >
                        iNaturalist
                      </a>
                      {sp.wikipedia_url && (
                        <a
                          href={sp.wikipedia_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="external-link"
                        >
                          Wikipédia
                        </a>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        {newlyUnlocked.length > 0 && (
          <div className="achievements">
            <h3>Succès débloqués :</h3>
            <ul>
              {newlyUnlocked.map((id) => (
                <li key={id}>{ACHIEVEMENTS[id]?.title || id}</li>
              ))}
            </ul>
          </div>
        )}
        <button onClick={onRestart} className="start-button">Rejouer</button>
        <button onClick={onReturnHome}>Retour à l'accueil</button>
      </div>
    </div>
  );
};

export default EndScreen;

