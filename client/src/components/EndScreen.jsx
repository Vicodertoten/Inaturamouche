import React, { useEffect } from 'react';
import { ACHIEVEMENTS } from '../achievements';
import { useLanguage } from '../context/LanguageContext.jsx';
import { notify } from '../services/notifications';
import { MASTERY_NAMES } from '../services/CollectionService';

const EndScreen = ({
  score,
  sessionCorrectSpecies = [],
  sessionSpeciesData = [],
  newlyUnlocked = [],
  sessionRewards = [],
  onRestart,
  onReturnHome,
  profile,
}) => {
  const { t, getTaxonDisplayNames } = useLanguage();

  useEffect(() => {
    if (sessionRewards && sessionRewards.length > 0) {
      sessionRewards.forEach((reward, index) => {
        setTimeout(() => {
          if (reward.type === 'NEW_SPECIES') {
            notify(`🦋 New species: ${reward.name}!`, { type: 'success', duration: 4000 });
          } else if (reward.type === 'LEVEL_UP') {
            notify(`🥇 Grade ${reward.level} reached for ${reward.name}!`, { type: 'success', duration: 5000 });
          }
        }, index * 1200 + 500); // Stagger notifications
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only once on mount

  const totalQuestions = sessionSpeciesData.length || 0;
  const correctCount = sessionCorrectSpecies.length;
  const accuracy = totalQuestions > 0 ? (correctCount / totalQuestions) * 100 : 0;

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
        <div className="summary">
          <p className="score-line">
            {t('end.final_score')} <span className="score">{score}</span>
          </p>
          <div className="stats">
            <span>{t('end.correct_count', { correct: correctCount, total: totalQuestions })}</span>
            <span>{t('end.accuracy', { value: accuracy.toFixed(0) })}</span>
          </div>
        </div>

        {sortedSpecies.length > 0 && (
          <section className="played-species">
            <h2>{t('end.species_seen')}</h2>
            <ul className="species-list">
              {sortedSpecies.map((sp) => {
                const isFound = sessionCorrectSpecies.includes(sp.id);
                const { primary, secondary } = getTaxonDisplayNames(sp);
                const isNewDiscovery = isFound && profile?.stats?.speciesMastery?.[sp.id]?.correct === 1;

                return (
                  <li
                    key={sp.id}
                    className={`species-item ${isFound ? 'found' : 'missed'}`}
                  >
                    <div className="species-info">
                      <div>
                        {primary && <span className="species-common">{primary}</span>}
                        {secondary && <em>{secondary}</em>}
                      </div>
                      {isNewDiscovery && <span className="discovery-badge">✨ Découverte Sauvage ajoutée au Classeur !</span>}
                    </div>
                    <div className="species-links">
                      <span
                        className="species-status"
                        aria-label={isFound ? t('end.status.correct') : t('end.status.incorrect')}
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
                          {t('end.links.inaturalist')}
                        </a>
                        {sp.wikipedia_url && (
                          <a
                            href={sp.wikipedia_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="external-link"
                          >
                            {t('end.links.wikipedia')}
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
            <h2>{t('end.achievements')}</h2>
            <ul>
              {newlyUnlocked.map((id) => (
                <li key={id}>{ACHIEVEMENTS[id]?.titleKey ? t(ACHIEVEMENTS[id].titleKey) : id}</li>
              ))}
            </ul>
          </section>
        )}

        <div className="end-actions">
          <button onClick={onRestart} className="start-button">
            {t('common.replay')}
          </button>
          <button onClick={onReturnHome}>{t('common.home')}</button>
        </div>
      </div>
    </div>
  );
};

export default EndScreen;
