import React, { useEffect, useMemo, useRef, useState } from 'react';
import XPProgressBar from './XPProgressBar';
import ShareButtons from './ShareButtons';
import DailyLeaderboard from './DailyLeaderboard';
import { getLevelFromXp } from '../utils/scoring';
import { useGameData } from '../context/GameContext';
import { ACHIEVEMENTS } from '../core/achievements';
import { useLanguage } from '../context/LanguageContext.jsx';
import { usePacks } from '../context/PacksContext.jsx';
import { notify } from '../services/notifications';
import { toSafeHttpUrl } from '../utils/mediaUtils';
import './EndScreen.css';

const IconBase = ({ className, children }) => (
  <svg
    aria-hidden="true"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    {children}
  </svg>
);

const SparklesIcon = ({ className }) => (
  <IconBase className={className}>
    <path d="M12 3l1.8 4.2L18 9l-4.2 1.8L12 15l-1.8-4.2L6 9l4.2-1.8L12 3z" />
    <path d="M19 14l.8 2L22 16.8l-2.2.8-.8 2-.8-2-2.2-.8 2.2-.8.8-2z" />
    <path d="M5 14l.6 1.5L7 16l-1.4.5L5 18l-.6-1.5L3 16l1.4-.5L5 14z" />
  </IconBase>
);

const TrophyIcon = ({ className }) => (
  <IconBase className={className}>
    <path d="M8 4h8v5a4 4 0 0 1-8 0V4z" />
    <path d="M8 6H6a2 2 0 0 0 0 4h2" />
    <path d="M16 6h2a2 2 0 0 1 0 4h-2" />
    <path d="M12 13v4" />
    <path d="M8 21h8" />
  </IconBase>
);

const LevelUpIcon = ({ className }) => (
  <IconBase className={className}>
    <path d="M12 19V5" />
    <path d="M5 12l7-7 7 7" />
  </IconBase>
);

const TargetIcon = ({ className }) => (
  <IconBase className={className}>
    <circle cx="12" cy="12" r="8" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="12" cy="12" r="1" />
  </IconBase>
);

const StreakIcon = ({ className }) => (
  <IconBase className={className}>
    <path d="M13 2L4 14h6l-1 8 9-12h-6l1-8z" />
  </IconBase>
);

const GemIcon = ({ className }) => (
  <IconBase className={className}>
    <path d="M6 9l3-5h6l3 5-6 11-6-11z" />
    <path d="M3 9h18" />
  </IconBase>
);

const FlaskIcon = ({ className }) => (
  <IconBase className={className}>
    <path d="M10 2v6l-5 8a3 3 0 0 0 2.6 4.5h8.8A3 3 0 0 0 19 16l-5-8V2" />
    <path d="M8 11h8" />
  </IconBase>
);

const ListIcon = ({ className }) => (
  <IconBase className={className}>
    <line x1="8" y1="6" x2="20" y2="6" />
    <line x1="8" y1="12" x2="20" y2="12" />
    <line x1="8" y1="18" x2="20" y2="18" />
    <circle cx="4" cy="6" r="1" />
    <circle cx="4" cy="12" r="1" />
    <circle cx="4" cy="18" r="1" />
  </IconBase>
);

const ChevronDownIcon = ({ className }) => (
  <IconBase className={className}>
    <polyline points="6 9 12 15 18 9" />
  </IconBase>
);

const ChevronRightIcon = ({ className }) => (
  <IconBase className={className}>
    <polyline points="9 6 15 12 9 18" />
  </IconBase>
);

const CheckCircleIcon = ({ className }) => (
  <IconBase className={className}>
    <circle cx="12" cy="12" r="9" />
    <path d="m9 12 2 2 4-4" />
  </IconBase>
);

const XCircleIcon = ({ className }) => (
  <IconBase className={className}>
    <circle cx="12" cy="12" r="9" />
    <path d="m9 9 6 6" />
    <path d="m15 9-6 6" />
  </IconBase>
);

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
  const rewardTimersRef = useRef([]);
  
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
    rewardTimersRef.current.forEach((timerId) => clearTimeout(timerId));
    rewardTimersRef.current = [];

    if (sessionRewards && sessionRewards.length > 0) {
      sessionRewards.forEach((reward, index) => {
        const timerId = setTimeout(() => {
          if (reward.type === 'NEW_SPECIES') {
            notify(t('notifications.new_species', { name: reward.name }), { type: 'success', duration: 4000 });
          } else if (reward.type === 'LEVEL_UP') {
            notify(t('notifications.level_up', { level: reward.level, name: reward.name }), { type: 'success', duration: 5000 });
          }
        }, index * 1200 + 500); // Stagger notifications
        rewardTimersRef.current.push(timerId);
      });
    }
    return () => {
      rewardTimersRef.current.forEach((timerId) => clearTimeout(timerId));
      rewardTimersRef.current = [];
    };
  }, [sessionRewards, t]);

  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    const prefersReduce = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!prefersReduce) {
      const start = setTimeout(() => setShowConfetti(true), 300);
      const stop = setTimeout(() => setShowConfetti(false), 4300);
      return () => { clearTimeout(start); clearTimeout(stop); };
    }
  }, []);

  const correctSpeciesSet = useMemo(
    () => new Set(sessionCorrectSpecies.map((id) => String(id))),
    [sessionCorrectSpecies]
  );

  const sortedSpecies = useMemo(() => {
    return [...sessionSpeciesData].sort((a, b) => {
      const aFound = correctSpeciesSet.has(String(a.id));
      const bFound = correctSpeciesSet.has(String(b.id));
      if (aFound === bFound) {
        return a.name.localeCompare(b.name);
      }
      return aFound ? -1 : 1;
    });
  }, [sessionSpeciesData, correctSpeciesSet]);

  // Calculer le nombre de nouvelles découvertes
  const newDiscoveries = useMemo(() => {
    return sortedSpecies.filter((sp) => {
      const isFound = correctSpeciesSet.has(String(sp.id));
      return isFound && profile?.stats?.speciesMastery?.[sp.id]?.correct === 1;
    });
  }, [sortedSpecies, correctSpeciesSet, profile?.stats?.speciesMastery]);

  const topSpeciesName = useMemo(() => {
    if (sessionCorrectSpecies.length === 0) return '';
    const first = sessionSpeciesData.find((sp) => correctSpeciesSet.has(String(sp.id)));
    if (!first) return '';
    const { primary } = getTaxonDisplayNames(first);
    return primary || '';
  }, [sessionCorrectSpecies.length, sessionSpeciesData, correctSpeciesSet, getTaxonDisplayNames]);

  const [showSpeciesList, setShowSpeciesList] = useState(false);

  return (
    <div className="screen end-screen">
      <div className="card">
        <h1 className="sr-only">{t('end.page_title', {}, 'Résultats de la partie')}</h1>
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
              <div className="level-up-icon" aria-hidden="true">
                <LevelUpIcon className="result-icon-svg" />
              </div>
              <h2 className="section-title">{t('end.level_up', {}, 'Passage au niveau')} {endLevel}!</h2>
            </div>
          ) : (
            <h2 className="section-title section-title-with-icon">
              <SparklesIcon className="section-title-icon" />
              {t('end.session_complete', {}, 'Session Terminée')}
            </h2>
          )}
          
          {sessionXPGained > 0 && (
            <div className="xp-gained-display">
              <span className="xp-gained-icon" aria-hidden="true">
                <SparklesIcon className="result-icon-svg" />
              </span>
              <span className="xp-gained-label">{t('end.xp_earned', {}, 'XP gagné cette session')}</span>
              <span className="xp-gained-value">+{sessionXPGained}</span>
            </div>
          )}

          {xpBreakdown && (
            <div className="xp-breakdown">
              <div className="xp-breakdown-row">
                <span className="xp-breakdown-label">
                  <TargetIcon className="xp-breakdown-icon" />
                  {t('end.xp_base', {}, 'Base')}
                </span>
                <span className="xp-breakdown-value">+{xpBreakdown.totalBase}</span>
              </div>
              {xpBreakdown.totalStreak > 0 && (
                <div className="xp-breakdown-row streak">
                  <span className="xp-breakdown-label">
                    <StreakIcon className="xp-breakdown-icon" />
                    {t('end.xp_streak', {}, 'Streak')}
                  </span>
                  <span className="xp-breakdown-value">+{xpBreakdown.totalStreak}</span>
                </div>
              )}
              {xpBreakdown.totalRarity > 0 && (
                <div className="xp-breakdown-row rarity">
                  <span className="xp-breakdown-label">
                    <GemIcon className="xp-breakdown-icon" />
                    {t('end.xp_rarity', {}, 'Rareté')}
                  </span>
                  <span className="xp-breakdown-value">+{xpBreakdown.totalRarity}</span>
                </div>
              )}
              {xpBreakdown.totalScientificBonus > 0 && (
                <div className="xp-breakdown-row scientific">
                  <span className="xp-breakdown-label">
                    <FlaskIcon className="xp-breakdown-icon" />
                    {t('end.xp_scientific_mode', {}, 'Nom scientifique (x2)')}
                  </span>
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
                <span className="multi-level-badge">
                  {t('end.multi_level', { count: endLevel - startLevel }, `${endLevel - startLevel} niveaux!`)}
                  <LevelUpIcon className="multi-level-icon" />
                </span>
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

        {/* 2. Achievements débloqués */}
        {newlyUnlocked.length > 0 && (
          <div className="achievements-section">
            <h3 className="section-title section-title-with-icon">
              <TrophyIcon className="section-title-icon" />
              {t('end.achievements_unlocked', {}, 'Achievements Débloqués')}
            </h3>
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

        {/* 3. Liste des espèces rencontrées (repliable) */}
        {sortedSpecies.length > 0 && (
          <div className="species-details-section">
            <div className="species-section-summary">
              <span className="species-summary-count">{newDiscoveries.length}</span>
              <span className="species-summary-label">
                {t('end.species_added_to_collection', {}, 'espèce(s) ajoutée(s) à la collection')}
              </span>
            </div>
            <button 
              className="species-toggle-button"
              onClick={() => setShowSpeciesList(!showSpeciesList)}
              type="button"
            >
              <span className="species-toggle-label">
                <ListIcon className="section-title-icon" />
                {t('end.species_seen', {}, 'Espèces rencontrées')}
              </span>
              <span className="species-toggle-meta">{sessionCorrectSpecies.length}/{sessionSpeciesData.length}</span>
              <span className="toggle-icon" aria-hidden="true">
                {showSpeciesList ? (
                  <ChevronDownIcon className="toggle-icon-svg" />
                ) : (
                  <ChevronRightIcon className="toggle-icon-svg" />
                )}
              </span>
            </button>
            
            {showSpeciesList && (
              <ul className="species-list">
                {sortedSpecies.map((sp) => {
                  const isFound = correctSpeciesSet.has(String(sp.id));
                  const { primary, secondary } = getTaxonDisplayNames(sp);
                  const isNewDiscovery = isFound && profile?.stats?.speciesMastery?.[sp.id]?.correct === 1;
                  const safeInaturalistUrl = toSafeHttpUrl(sp.inaturalist_url);
                  const safeWikipediaUrl = toSafeHttpUrl(sp.wikipedia_url);

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
                          className={`species-status ${isFound ? 'found' : 'missed'}`}
                          aria-label={isFound ? t('end.status.correct') : t('end.status.incorrect')}
                        >
                          {isFound ? (
                            <CheckCircleIcon className="species-status-icon" />
                          ) : (
                            <XCircleIcon className="species-status-icon" />
                          )}
                        </span>
                        <div className="external-links-container">
                          {safeInaturalistUrl && (
                            <a
                              href={safeInaturalistUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="external-link"
                            >
                              {t('end.links.inaturalist')}
                            </a>
                          )}
                          {safeWikipediaUrl && (
                            <a
                              href={safeWikipediaUrl}
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
            topSpecies={topSpeciesName}
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
