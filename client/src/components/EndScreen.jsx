import React, { useEffect, useState } from 'react';
import XPProgressBar from './XPProgressBar';
import { getLevelFromXp } from '../utils/scoring';
import { useGameData } from '../context/GameContext';
import { ACHIEVEMENTS } from '../core/achievements';
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
  isDailyChallenge = false,
}) => {
  const { t, getTaxonDisplayNames } = useLanguage();
  const { initialSessionXP } = useGameData();
  
  // Prefer the larger of local session `score` or the profile-based difference.
  // This preserves existing tests (which mock profile.xp) while still showing
  // immediate XP when the profile hasn't been updated yet.
  const profileDiff = Math.max(0, (profile?.xp || 0) - (initialSessionXP || 0));
  const sessionXPGained = Math.max(score || 0, profileDiff);
  // Visual current XP is initial + session gain to force the progress animation
  const currentXP = (initialSessionXP || 0) + sessionXPGained;
  const startLevel = getLevelFromXp(initialSessionXP || 0);
  const endLevel = getLevelFromXp(currentXP);
  // Level up seulement si on a vraiment gagné de l'XP ET que le niveau a changé
  const leveledUp = sessionXPGained > 0 && endLevel > startLevel;

  // Callback pour les level-ups détectés lors de l'animation XP
  const handleLevelUp = (newLevel) => {
    notify(t('notifications.level_up', { level: newLevel }, `Niveau ${newLevel} atteint!`), {
      type: 'success',
      duration: 4000,
    });
  };

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
            <div className="xp-gained-display">
              <span className="xp-gained-icon">⭐</span>
              <span className="xp-gained-label">{t('end.xp_earned', {}, 'XP gagné cette session')}</span>
              <span className="xp-gained-value">+{sessionXPGained}</span>
            </div>
          )}
          
          {leveledUp && (
            <div className="level-progress-info">
              <span className="level-from">Niveau {startLevel}</span>
              <span className="level-arrow">→</span>
              <span className="level-to">Niveau {endLevel}</span>
              {(endLevel - startLevel) > 1 && (
                <span className="multi-level-badge">{endLevel - startLevel} niveaux! 🚀</span>
              )}
            </div>
          )}
          
          <div className="level-info">
            
            <XPProgressBar 
                currentXP={currentXP}
                startXP={initialSessionXP || 0}
                recentXPGain={sessionXPGained}
                showDetailed={true}
                animate={true}
                size="default"
                onLevelUp={handleLevelUp}
              />
          </div>
        </div>

        {/* 2. Nouvelles découvertes */}
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

        {/* 3. Achievements débloqués */}
        {newlyUnlocked.length > 0 && (
          <div className="achievements-section">
            <h3 className="section-title">{t('end.achievements_unlocked', {}, '🏆 Achievements Débloqués')}</h3>
            <ul className="achievements-list">
              {newlyUnlocked.map((id) => {
                const achievement = ACHIEVEMENTS[id];
                return (
                  <li key={id} className="achievement-item">
                    <span className="achievement-title">
                      {achievement?.titleKey ? t(achievement.titleKey) : id}
                    </span>
                    {achievement?.descriptionKey && (
                      <span className="achievement-description">
                        {t(achievement.descriptionKey)}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* 4. Liste détaillée des espèces (repliable) */}
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
          {!isDailyChallenge && (
            <button onClick={onRestart} className="btn btn--primary">
              {t('common.replay')}
            </button>
          )}
          <button onClick={onReturnHome} className="btn btn--secondary">{t('common.home')}</button>
        </div>
      </div>
    </div>
  );
};

export default EndScreen;
