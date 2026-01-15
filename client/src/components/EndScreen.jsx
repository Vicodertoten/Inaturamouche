import React, { useEffect, useState } from 'react';
import XPProgressBar from './XPProgressBar';
import { getLevelFromXp } from '../utils/scoring';
import { useGameData } from '../context/GameContext';
import { ACHIEVEMENTS } from '../achievements';
import { useLanguage } from '../context/LanguageContext.jsx';
import { notify } from '../services/notifications';
import { MASTERY_NAMES } from '../services/CollectionService';
import './EndScreen.css';

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
  const { initialSessionXP } = useGameData();
  
  const currentXP = profile?.xp || 0;
  const sessionXPGained = Math.max(0, currentXP - (initialSessionXP || 0));
  const startLevel = getLevelFromXp(initialSessionXP || 0);
  const endLevel = getLevelFromXp(currentXP);
  // Level up seulement si on a vraiment gagné de l'XP ET que le niveau a changé
  const leveledUp = sessionXPGained > 0 && endLevel > startLevel;

  useEffect(() => {
    if (sessionRewards && sessionRewards.length > 0) {
      sessionRewards.forEach((reward, index) => {
        setTimeout(() => {
          if (reward.type === 'NEW_SPECIES') {
            notify(t('notifications.new_species', { name: reward.name }), { type: 'success', duration: 4000 });
          } else if (reward.type === 'LEVEL_UP') {
            notify(t('notifications.level_up', { level: reward.level, name: reward.name }), { type: 'success', duration: 5000 });
          }
        }, index * 1200 + 500); // Stagger notifications
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only once on mount

  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    const prefersReduce = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!prefersReduce) {
      const start = setTimeout(() => setShowConfetti(true), 300);
      const stop = setTimeout(() => setShowConfetti(false), 4300);
      return () => { clearTimeout(start); clearTimeout(stop); };
    }
  }, []);

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

  // Calculer le nombre de nouvelles découvertes
  const newDiscoveries = sortedSpecies.filter(sp => {
    const isFound = sessionCorrectSpecies.includes(sp.id);
    return isFound && profile?.stats?.speciesMastery?.[sp.id]?.correct === 1;
  });

  const [showSpeciesList, setShowSpeciesList] = useState(false);

  return (
    <div className="screen end-screen">
      <div className="card">
        {showConfetti && (
          <div className="confetti" aria-hidden="true">
            {Array.from({ length: 12 }).map((_, i) => (
              <span key={i} className="confetti-piece" />
            ))}
          </div>
        )}

        {/* 1. XP et Progression fusionnés */}
        <div className="xp-progress-unified-section">
          {leveledUp ? (
            <div className="level-up-header">
              <div className="level-up-icon">🎉</div>
              <h2 className="section-title">{t('end.level_up', {}, 'Passage au niveau')} {endLevel}!</h2>
            </div>
          ) : (
            <h2 className="section-title">{t('end.session_complete', {}, '✨ Session Terminée')}</h2>
          )}
          
          {sessionXPGained > 0 && (
            <div className="xp-gained-display">+{sessionXPGained} XP</div>
          )}
          
          <div className="level-info">
            
            <XPProgressBar 
              currentXP={currentXP}
              recentXPGain={0}
              showDetailed={true}
              animate={false}
              size="default"
            />
          </div>
        </div>

        {/* 2. Précision (plus dense) */}
        <div className="accuracy-section">
          <div className="accuracy-inline">
            <span className="accuracy-label">📊 {t('end.precision', {}, 'Précision')}</span>
            <span className="accuracy-value">{accuracy.toFixed(0)}%</span>
            <span className="accuracy-details">({correctCount}/{totalQuestions})</span>
          </div>
        </div>

        {/* 3. Nouvelles découvertes */}
        {newDiscoveries.length > 0 && (
          <div className="new-discoveries-section">
            <h3 className="section-title">{t('end.new_discoveries', {}, '✨ Nouvelles Découvertes')}</h3>
            <div className="discoveries-count">
              {newDiscoveries.length} {t('end.species_added', {}, 'espèce(s) ajoutée(s) au guide')}
            </div>
            <ul className="discoveries-list">
              {newDiscoveries.map((sp) => {
                const { primary, secondary } = getTaxonDisplayNames(sp);
                return (
                  <li key={sp.id} className="discovery-item">
                    {primary && <span className="species-common">{primary}</span>}
                    {secondary && <em className="species-scientific">{secondary}</em>}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* 4. Achievements débloqués */}
        {newlyUnlocked.length > 0 && (
          <div className="achievements-section">
            <h3 className="section-title">{t('end.achievements_unlocked', {}, '🏆 Achievements Débloqués')}</h3>
            <ul className="achievements-list">
              {newlyUnlocked.map((id) => (
                <li key={id} className="achievement-item">
                  {ACHIEVEMENTS[id]?.titleKey ? t(ACHIEVEMENTS[id].titleKey) : id}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 5. Liste détaillée des espèces (repliable) */}
        {sortedSpecies.length > 0 && (
          <div className="species-details-section">
            <button 
              className="species-toggle-button"
              onClick={() => setShowSpeciesList(!showSpeciesList)}
              type="button"
            >
              <span>{t('end.species_seen', {}, '📜 Liste détaillée des espèces')}</span>
              <span className="toggle-icon">{showSpeciesList ? '▼' : '▶'}</span>
            </button>
            
            {showSpeciesList && (
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
                        {isNewDiscovery && <span className="discovery-badge">{t('end.new_discovery')}</span>}
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
            )}
          </div>
        )}

        <div className="end-actions">
          <button onClick={onRestart} className="btn btn--primary">
            {t('common.replay')}
          </button>
          <button onClick={onReturnHome} className="btn btn--secondary">{t('common.home')}</button>
        </div>
      </div>
    </div>
  );
};

export default EndScreen;
