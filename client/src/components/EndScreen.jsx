import React, { useEffect, useState } from 'react';
import XPProgressBar from './XPProgressBar';
import ShareButtons from './ShareButtons';
import DailyLeaderboard from './DailyLeaderboard';
import { getLevelFromXp } from '../utils/scoring';
import { useGameData } from '../context/GameContext';
import { ACHIEVEMENTS } from '../core/achievements';
import { useLanguage } from '../context/LanguageContext.jsx';
import { usePacks } from '../context/PacksContext.jsx';
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
  activePackId,
  gameMode,
  maxQuestions,
  mediaType,
}) => {
  const { t, getTaxonDisplayNames } = useLanguage();
  const { initialSessionXP } = useGameData();
  const { packs } = usePacks();
  
  // XP breakdown from per-round economy data (computed first as it's the canonical source)
  const xpBreakdown = React.useMemo(() => {
    if (!sessionSpeciesData || sessionSpeciesData.length === 0) return null;
    let totalBase = 0;
    let totalStreak = 0;
    let totalRarity = 0;
    let totalFinal = 0;
    sessionSpeciesData.forEach((sp) => {
      if (!sp?.economy) return;
      totalBase += sp.economy.baseXp || 0;
      totalStreak += sp.economy.streakBonus || 0;
      totalRarity += sp.economy.rarityBonus || 0;
      totalFinal += sp.economy.finalXp || sp.earnedXp || 0;
    });
    const totalBaseAndBonuses = totalBase + totalStreak + totalRarity;
    const totalScientificBonus = Math.max(0, totalFinal - totalBaseAndBonuses);
    const total = totalBaseAndBonuses + totalScientificBonus;
    if (total === 0) return null;
    return { totalBase, totalStreak, totalRarity, totalScientificBonus, total };
  }, [sessionSpeciesData]);

  // Session XP: prefer the precise breakdown total, fall back to profile diff or score
  const profileDiff = Math.max(0, (profile?.xp || 0) - (initialSessionXP || 0));
  const sessionXPGained = xpBreakdown?.total || Math.max(score || 0, profileDiff);
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

          {xpBreakdown && (
            <div className="xp-breakdown">
              <div className="xp-breakdown-row">
                <span className="xp-breakdown-label">🎯 {t('end.xp_base', {}, 'Base')}</span>
                <span className="xp-breakdown-value">+{xpBreakdown.totalBase}</span>
              </div>
              {xpBreakdown.totalStreak > 0 && (
                <div className="xp-breakdown-row streak">
                  <span className="xp-breakdown-label">🔥 {t('end.xp_streak', {}, 'Streak')}</span>
                  <span className="xp-breakdown-value">+{xpBreakdown.totalStreak}</span>
                </div>
              )}
              {xpBreakdown.totalRarity > 0 && (
                <div className="xp-breakdown-row rarity">
                  <span className="xp-breakdown-label">💎 {t('end.xp_rarity', {}, 'Rareté')}</span>
                  <span className="xp-breakdown-value">+{xpBreakdown.totalRarity}</span>
                </div>
              )}
              {xpBreakdown.totalScientificBonus > 0 && (
                <div className="xp-breakdown-row streak">
                  <span className="xp-breakdown-label">🧪 {t('end.xp_scientific_mode', {}, 'Nom scientifique (x2)')}</span>
                  <span className="xp-breakdown-value">+{xpBreakdown.totalScientificBonus}</span>
                </div>
              )}
            </div>
          )}
          
          {leveledUp && (
            <div className="level-progress-info">
              <span className="level-from">{t('end.level_from', { level: startLevel }, `Niveau ${startLevel}`)}</span>
              <span className="level-arrow">→</span>
              <span className="level-to">{t('end.level_to', { level: endLevel }, `Niveau ${endLevel}`)}</span>
              {(endLevel - startLevel) > 1 && (
                <span className="multi-level-badge">{t('end.multi_level', { count: endLevel - startLevel }, `${endLevel - startLevel} niveaux!`)} 🚀</span>
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
          {/* Share & Challenge */}
          <ShareButtons
            score={sessionCorrectSpecies.length}
            total={sessionSpeciesData.length}
            packName={(() => {
              const pack = packs?.find(p => p.id === activePackId);
              return pack?.titleKey ? t(pack.titleKey) : '';
            })()}
            topSpecies={(() => {
              if (sessionCorrectSpecies.length === 0) return '';
              const first = sessionSpeciesData.find(sp => sessionCorrectSpecies.includes(sp.id));
              if (!first) return '';
              const { primary } = getTaxonDisplayNames(first);
              return primary || '';
            })()}
            isDaily={isDailyChallenge}
            mode={gameMode === 'hard' ? t('config.mode_hard', {}, 'Difficile') : t('config.mode_easy', {}, 'Facile')}
            activePackId={activePackId}
            gameMode={gameMode}
            maxQuestions={maxQuestions}
            mediaType={mediaType}
          />

          {/* Daily Leaderboard */}
          {isDailyChallenge && (
            <DailyLeaderboard
              playerScore={sessionCorrectSpecies.length}
              playerTotal={sessionSpeciesData.length}
              playerPseudo={(() => {
                try { return localStorage.getItem('daily_pseudo') || ''; } catch { return ''; }
              })()}
            />
          )}
        </div>

        <div className="end-actions end-nav-actions">
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
