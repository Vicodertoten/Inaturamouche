import React from 'react';
import { ACHIEVEMENTS } from '../achievements';

const EndScreen = ({
  score,
  sessionCorrectSpecies = [],
  sessionSpeciesData = [],
  newlyUnlocked = [],
  onRestart,
  onReturnHome,
}) => {
  const totalQuestions = sessionSpeciesData.length || 0;
  const correctCount = sessionCorrectSpecies.length;
  const accuracy = totalQuestions > 0 ? (correctCount / totalQuestions) * 100 : 0;
  const isWin = correctCount >= Math.ceil(totalQuestions / 2);

  const sortedSpecies = [...sessionSpeciesData].sort((a, b) => {
    const aFound = sessionCorrectSpecies.includes(a.id);
    const bFound = sessionCorrectSpecies.includes(b.id);
    if (aFound === bFound) {
      return a.name.localeCompare(b.name);
    }
    return aFound ? -1 : 1;
  });

  return (
    <div className="screen end-screen">
      <div className="card">
        <h1>{isWin ? 'Victoire !' : 'Défaite'}</h1>
        <div className="summary">
          <p className="score-line">
            Score final : <span className="score">{score}</span>
          </p>
          <div className="stats">
            <span>
              {correctCount} / {totalQuestions} correctes
            </span>
            <span>Précision {accuracy.toFixed(0)}%</span>
          </div>
        </div>

        {sortedSpecies.length > 0 && (
          <section className="played-species">
            <h2>Espèces rencontrées</h2>
            <ul className="species-list">
              {sortedSpecies.map((sp) => {
                const displayCommon =
                  sp.common_name && sp.common_name !== sp.name ? sp.common_name : null;
                const isFound = sessionCorrectSpecies.includes(sp.id);
                return (
                  <li
                    key={sp.id}
                    className={`species-item ${isFound ? 'found' : 'missed'}`}
                  >
                    <div className="species-info">
                      {displayCommon && <span className="species-common">{displayCommon}</span>}
                      <em>{sp.name}</em>
                    </div>
                    <div className="species-links">
                      <span
                        className="species-status"
                        aria-label={isFound ? 'Correct' : 'Incorrect'}
                      >
                        {isFound ? '✅' : '❌'}
                      </span>
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
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {newlyUnlocked.length > 0 && (
          <section className="achievements">
            <h2>Succès débloqués</h2>
            <ul>
              {newlyUnlocked.map((id) => (
                <li key={id}>{ACHIEVEMENTS[id]?.title || id}</li>
              ))}
            </ul>
          </section>
        )}

        <div className="end-actions">
          <button onClick={onRestart} className="start-button">
            Rejouer
          </button>
          <button onClick={onReturnHome}>Accueil</button>
        </div>
      </div>
    </div>
  );
};

export default EndScreen;

