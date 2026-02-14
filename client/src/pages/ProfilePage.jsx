import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ACHIEVEMENTS,
  ACHIEVEMENT_CATEGORIES,
  REWARD_TYPES,
  getTitleDetails,
  getBorderDetails,
  getRewardForAchievement,
} from '../core/achievements';
import { useUser } from '../context/UserContext';
import { getTaxaByIds } from '../services/api';
import { notify } from '../services/notifications.js';
import { resetProfile } from '../services/PlayerProfile';
import DailyStreakBadge from '../components/DailyStreakBadge';
import ProfileStreakCard from '../components/ProfileStreakCard';
import ProfileConfigurator from '../components/ProfileConfigurator';
import '../components/ProfileModal.css';
import { useLanguage } from '../context/LanguageContext.jsx';
import { usePacks } from '../context/PacksContext.jsx';
import Modal from '../components/Modal';
import Spinner from '../components/Spinner';
import { getLevelFromXp, getXpForLevel } from '../utils/scoring';
import { getReviewStats } from '../services/CollectionService';

const MasteryItem = ({ taxon, count, getDisplayNames, t }) => {
  if (!taxon) return null;
  const { primary, secondary } = getDisplayNames(taxon);
  return (
    <li className="mastery-item">
      <span className="mastery-name">
        {primary}
        {secondary && <small className="mastery-secondary">{secondary}</small>}
      </span>
      <span className="mastery-count">{t('profile.mastery_count', { count })}</span>
    </li>
  );
};

/**
 * Composant pour afficher la récompense de façon compacte
 */
const RewardBadge = ({ reward, t }) => {
  if (!reward) return null;

  const getRewardDisplay = () => {
    switch (reward.type) {
      case REWARD_TYPES.XP_FLAT:
        return { icon: '✨', label: `+${reward.value} XP` };
      case REWARD_TYPES.PERM_MULTIPLIER:
        return { icon: '📈', label: `+${Math.round(reward.value * 100)}%` };
      case REWARD_TYPES.TITLE:
        return { icon: '🏷️', label: t('rewards.title') };
      case REWARD_TYPES.BORDER:
        return { icon: '🖼️', label: t('rewards.border') };
      default:
        return null;
    }
  };

  const display = getRewardDisplay();
  if (!display) return null;

  return (
    <span className={`reward-badge reward-badge-${reward.type.toLowerCase()}`}>
      <span className="reward-badge-icon">{display.icon}</span>
      <span className="reward-badge-label">{display.label}</span>
    </span>
  );
};

/**
 * Composant carte de succès avec récompense
 */
const AchievementCard = ({ achievement, unlocked, reward, t }) => {
  return (
    <li
      className={`achievement-card ${unlocked ? 'unlocked' : 'locked'}`}
      aria-label={achievement.titleKey ? t(achievement.titleKey) : achievement.id}
    >
      <div className="achievement-icon" aria-hidden="true">
        {achievement.icon}
      </div>
      <div className="achievement-details">
        <h4 className="achievement-title">
          {achievement.titleKey ? t(achievement.titleKey) : achievement.id}
        </h4>
        {achievement.descriptionKey && (
          <p className="achievement-description">{t(achievement.descriptionKey)}</p>
        )}
        {reward && <RewardBadge reward={reward} t={t} />}
      </div>
    </li>
  );
};

const ProfilePage = () => {
  const navigate = useNavigate();
  const { profile, refreshProfile, updateProfile } = useUser();
  const { t, getTaxonDisplayNames, language, formatNumber } = useLanguage();
  const { packs } = usePacks();
  const [activeTab, setActiveTab] = useState('summary');
  const [masteryDetails, setMasteryDetails] = useState([]);
  const [isLoadingMastery, setIsLoadingMastery] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  // Profile configurator modal state
  const [isConfiguratorOpen, setIsConfiguratorOpen] = useState(false);
  // Review stats
  const [reviewStats, setReviewStats] = useState(null);
  const [openCategories, setOpenCategories] = useState(() => ({
    [ACHIEVEMENT_CATEGORIES.TAXONOMY]: false,
    [ACHIEVEMENT_CATEGORIES.COLLECTION]: false,
    [ACHIEVEMENT_CATEGORIES.SKILL]: false,
    [ACHIEVEMENT_CATEGORIES.HABIT]: false,
  }));

  const sortedMastery = useMemo(
    () =>
      Object.entries(profile?.stats?.speciesMastery || {})
        .map(([id, data]) => [id, data.correct || 0])
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5),
    [profile?.stats?.speciesMastery]
  );

  const levelInfo = useMemo(() => {
    const level = getLevelFromXp(profile?.xp);
    const xpForCurrentLevel = getXpForLevel(level);
    const xpForNextLevel = getXpForLevel(level + 1);
    const xpProgress = (profile?.xp || 0) - xpForCurrentLevel;
    const xpNeededForLevel = xpForNextLevel - xpForCurrentLevel;
    const progressPercentage = xpNeededForLevel > 0 ? (xpProgress / xpNeededForLevel) * 100 : 100;
    return {
      level,
      xpForCurrentLevel,
      xpForNextLevel,
      xpProgress,
      xpNeededForLevel,
      progressPercentage,
    };
  }, [profile?.xp]);

  const accuracyStats = useMemo(() => {
    const totalAnswered =
      (profile?.stats?.easyQuestionsAnswered || 0) +
      (profile?.stats?.hardQuestionsAnswered || 0) +
      (profile?.stats?.riddleQuestionsAnswered || 0);
    const totalCorrect =
      (profile?.stats?.correctEasy || 0) +
      (profile?.stats?.correctHard || 0) +
      (profile?.stats?.correctRiddle || 0);
    return {
      totalAnswered,
      totalCorrect,
      overallAccuracy: totalAnswered > 0 ? ((totalCorrect / totalAnswered) * 100).toFixed(1) : '0.0',
      easyAccuracy: ((profile?.stats?.accuracyEasy || 0) * 100).toFixed(1),
      riddleAccuracy: ((profile?.stats?.accuracyRiddle || 0) * 100).toFixed(1),
      hardAccuracy: ((profile?.stats?.accuracyHard || 0) * 100).toFixed(1),
    };
  }, [
    profile?.stats?.accuracyEasy,
    profile?.stats?.accuracyRiddle,
    profile?.stats?.accuracyHard,
    profile?.stats?.correctEasy,
    profile?.stats?.correctHard,
    profile?.stats?.correctRiddle,
    profile?.stats?.easyQuestionsAnswered,
    profile?.stats?.riddleQuestionsAnswered,
    profile?.stats?.hardQuestionsAnswered,
  ]);

  const packStats = useMemo(
    () => Object.entries(profile?.stats?.packsPlayed || {}),
    [profile?.stats?.packsPlayed]
  );

  const displayName = useMemo(
    () => profile?.name || profile?.username || t('profile.title'),
    [profile?.name, profile?.username, t]
  );
  
  // Compute avatar display
  const avatarDisplay = useMemo(() => {
    if (profile?.avatar?.type === 'emoji') {
      return { type: 'emoji', value: profile.avatar.value };
    }
    if (profile?.avatar?.type === 'image') {
      return { type: 'image', value: profile.avatar.value };
    }
    return { type: 'letter', value: displayName ? displayName.charAt(0).toUpperCase() : 'E' };
  }, [profile?.avatar, displayName]);

  useEffect(() => {
    if (activeTab !== 'stats' || !profile || sortedMastery.length === 0 || masteryDetails.length > 0) {
      return;
    }

    const loadMastery = async () => {
      setIsLoadingMastery(true);
      try {
        const idsToFetch = sortedMastery.map(([id]) => id);
        const taxaData = await getTaxaByIds(idsToFetch, language);
        const detailsWithCount = sortedMastery.map(([id, count]) => {
          const taxonDetail = taxaData.find((t) => t.id == id);
          return { id, taxon: taxonDetail, count };
        });
        setMasteryDetails(detailsWithCount);
      } catch (error) {
        if (!error?.notified) {
          notify('Impossible de charger les especes maitrisees.', { type: 'error' });
        }
      }
      setIsLoadingMastery(false);
    };

    loadMastery();
  }, [activeTab, language, masteryDetails.length, profile, sortedMastery]);

  // Load review stats
  useEffect(() => {
    const loadReviewStats = async () => {
      const stats = await getReviewStats();
      setReviewStats(stats);
    };
    
    loadReviewStats();
  }, []);

  const handleResetProfile = useCallback(() => {
    setIsResetModalOpen(true);
  }, []);

  const handleCloseResetModal = useCallback(() => {
    setIsResetModalOpen(false);
  }, []);

  const confirmResetProfile = useCallback(() => {
    resetProfile();
    refreshProfile();
    setIsResetModalOpen(false);
  }, [refreshProfile]);

  const handleBack = useCallback(() => {
    const historyState = window.history.state || {};
    const canGoBack =
      typeof historyState.idx === 'number' ? historyState.idx > 0 : window.history.length > 1;
    if (canGoBack) navigate(-1);
    else navigate('/', { replace: true });
  }, [navigate]);

  // Profile configurator handlers
  const handleOpenConfigurator = useCallback(() => {
    setIsConfiguratorOpen(true);
  }, []);

  const handleCloseConfigurator = useCallback(() => {
    setIsConfiguratorOpen(false);
  }, []);

  const handleSaveProfileChanges = useCallback((changes) => {
    updateProfile((prev) => ({
      ...prev,
      name: changes.name || prev.name,
      avatar: changes.avatar,
      rewards: {
        ...prev.rewards,
        equippedTitle: changes.equippedTitle || prev.rewards?.equippedTitle || 'default',
        equippedBorder: changes.equippedBorder || prev.rewards?.equippedBorder || 'default',
      },
    }));
    notify(t('profile.save_success'), { type: 'success' });
  }, [updateProfile, t]);

  const toggleCategory = useCallback((category) => {
    setOpenCategories((prev) => ({
      ...prev,
      [category]: !prev?.[category],
    }));
  }, []);

  // Regrouper les succès par catégorie
  const achievementsByCategory = useMemo(() => {
    const categories = {
      [ACHIEVEMENT_CATEGORIES.TAXONOMY]: [],
      [ACHIEVEMENT_CATEGORIES.COLLECTION]: [],
      [ACHIEVEMENT_CATEGORIES.SKILL]: [],
      [ACHIEVEMENT_CATEGORIES.HABIT]: [],
    };
    
    Object.entries(ACHIEVEMENTS).forEach(([id, achievement]) => {
      const category = achievement.category || ACHIEVEMENT_CATEGORIES.SKILL;
      if (categories[category]) {
        categories[category].push({ id, ...achievement });
      }
    });
    
    return categories;
  }, []);

  if (!profile) {
    return (
      <div className="screen profile-screen">
        <div className="card">
          <p>{t('profile.loading')}</p>
        </div>
      </div>
    );
  }

  const unlockedAchievements = profile.achievements || [];

  // Récupérer le titre et la bordure équipés
  const equippedTitle = profile.rewards?.equippedTitle || 'default';
  const equippedBorder = profile.rewards?.equippedBorder || 'default';
  const titleDetails = getTitleDetails(equippedTitle);
  const borderDetails = getBorderDetails(equippedBorder);
  const borderCss = borderDetails?.css || '';

  return (
    <div className="screen profile-screen">
      <div className="profile-modal profile-page-card profile-dashboard">
        <button className="back-button" onClick={handleBack} aria-label={t('profile.back')}>
          {t('profile.back')}
        </button>

        <div className="profile-hero sticky-hero tutorial-profile-hero">
          {/* Edit button - top left */}
          <button
            type="button"
            className="profile-edit-btn"
            onClick={handleOpenConfigurator}
            aria-label={t('profile.edit_profile')}
            title={t('profile.edit_profile')}
          >
            ✏️
          </button>

          {/* Main hero content - centered layout */}
          <div className="hero-content">
            {/* Avatar */}
            <div className={`avatar-ring ${borderCss}`} aria-label={t('profile.title')}>
              {avatarDisplay.type === 'emoji' && (
                <span className="avatar-emoji">{avatarDisplay.value}</span>
              )}
              {avatarDisplay.type === 'image' && (
                <img src={avatarDisplay.value} alt="Avatar" className="avatar-image" />
              )}
              {avatarDisplay.type === 'letter' && (
                <span className="avatar-letter">{avatarDisplay.value}</span>
              )}
            </div>

            {/* Name */}
            <h2 className="player-name">{displayName}</h2>

            {/* Equipped title */}
            {titleDetails && equippedTitle !== 'default' && (
              <p className="equipped-title">{titleDetails.value || t(titleDetails.nameKey)}</p>
            )}

            {/* Level chip */}
            <div className="level-chip">
              <span className="level-label">{t('profile.level', { level: levelInfo.level })}</span>
              <span className="level-number">#{levelInfo.level}</span>
            </div>

            {/* XP Progress */}
            <div className="hero-progress">
              <div className="xp-bar-container xp-bar-hero" aria-label={t('profile.xp_counter', { current: formatNumber(levelInfo.xpProgress), total: formatNumber(levelInfo.xpNeededForLevel) })}>
                <div className="xp-bar" style={{ width: `${levelInfo.progressPercentage}%` }}></div>
                <div className="xp-shine" />
              </div>
              <div className="xp-label hero-xp-label">
                <span>
                  {t('profile.xp_counter', {
                    current: formatNumber(levelInfo.xpProgress),
                    total: formatNumber(levelInfo.xpNeededForLevel),
                  })}
                </span>
                <span className="xp-total">XP: {formatNumber(profile.xp)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="tabs-container pill-tabs tutorial-profile-tabs" role="tablist" aria-label={t('profile.title')}>
          <button
            className={`tab-button pill ${activeTab === 'summary' ? 'active' : ''}`}
            onClick={() => setActiveTab('summary')}
            role="tab"
            aria-selected={activeTab === 'summary'}
            aria-controls="tab-summary"
            id="tab-summary-trigger"
          >
            {t('profile.tabs.summary')}
          </button>
          <button
            className={`tab-button pill ${activeTab === 'stats' ? 'active' : ''}`}
            onClick={() => setActiveTab('stats')}
            role="tab"
            aria-selected={activeTab === 'stats'}
            aria-controls="tab-stats"
            id="tab-stats-trigger"
          >
            {t('profile.tabs.stats')}
          </button>
          <button
            className={`tab-button pill ${activeTab === 'achievements' ? 'active' : ''}`}
            onClick={() => setActiveTab('achievements')}
            role="tab"
            aria-selected={activeTab === 'achievements'}
            aria-controls="tab-achievements"
            id="tab-achievements-trigger"
          >
            {t('profile.tabs.achievements')}
          </button>
        </div>

        <div className="tab-content">
          {activeTab === 'summary' && (
            <div
              className="fade-in"
              id="tab-summary"
              role="tabpanel"
              aria-live="polite"
              aria-labelledby="tab-summary-trigger"
            >
              <div className="tutorial-streaks">
                <DailyStreakBadge />
                <ProfileStreakCard
                  currentStreak={profile.stats.lastSessionStreak || 0}
                  longestStreak={profile.stats.longestStreak || 0}
                />
              </div>

              <div className="profile-section">
                <h3>{t('profile.summary_title')}</h3>
                <div className="stats-grid summary-grid stat-cards">
                  <div className="stat-item card-elevated">
                    <span className="stat-value">{profile.xp.toLocaleString()}</span>
                    <span className="stat-label">{t('profile.stats_labels.xp')}</span>
                  </div>
                  <div className="stat-item card-elevated">
                    <span className="stat-value">{profile.stats.gamesPlayed || 0}</span>
                    <span className="stat-label">{t('profile.stats_labels.games')}</span>
                  </div>
                  <div className="stat-item card-elevated">
                    <span className="stat-value">{accuracyStats.overallAccuracy}%</span>
                    <span className="stat-label">{t('profile.stats_labels.accuracy')}</span>
                  </div>
                </div>
              </div>

              <div className="profile-section profile-reset-section">
                <button className="action-button reset-profile-button" onClick={handleResetProfile}>
                  {t('profile.reset_button')}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'stats' && (
            <div
              className="fade-in"
              id="tab-stats"
              role="tabpanel"
              aria-live="polite"
              aria-labelledby="tab-stats-trigger"
            >
              <div className="profile-section">
                <h3>{t('profile.accuracy_title')}</h3>
                <div className="stats-grid stat-cards">
                  <div className="stat-item card-elevated">
                    <span className="stat-value">{accuracyStats.easyAccuracy}%</span>
                    <span className="stat-label">{t('profile.modes.easy')}</span>
                  </div>
                  <div className="stat-item card-elevated">
                    <span className="stat-value">{accuracyStats.riddleAccuracy}%</span>
                    <span className="stat-label">{t('profile.modes.riddle')}</span>
                  </div>
                  <div className="stat-item card-elevated">
                    <span className="stat-value">{accuracyStats.hardAccuracy}%</span>
                    <span className="stat-label">{t('profile.modes.hard')}</span>
                  </div>
                  <div className="stat-item card-elevated">
                    <span className="stat-value">{accuracyStats.overallAccuracy}%</span>
                    <span className="stat-label">{t('profile.stats_labels.accuracy')}</span>
                  </div>
                </div>
              </div>

              <div className="profile-section">
                <h3>{t('profile.pack_stats_title')}</h3>
                <ul className="pack-stats-grid">
                  {packStats.map(([packId, { correct, answered }]) => {
                    const pack = packs.find((p) => p.id === packId);
                    const accuracy =
                      answered > 0 ? ((correct / answered) * 100).toFixed(1) : '0.0';
                    return (
                      <li key={packId} className="pack-stat-card card-elevated">
                        <span className="pack-name">{pack?.titleKey ? t(pack.titleKey) : packId}</span>
                        <span className="pack-count">
                          {t('profile.pack_accuracy', { correct, answered, accuracy })}
                        </span>
                      </li>
                    );
                  })}
                  {packStats.length === 0 && (
                    <p className="empty-state">{t('profile.no_pack_stats')}</p>
                  )}
                </ul>
              </div>

              <div className="profile-section">
                <h3>📚 {t('profile.review_stats_title', {}, 'Système de Révision')}</h3>
                <div className="stats-grid stat-cards">
                  <div className="stat-item card-elevated">
                    <span className="stat-value">{reviewStats?.dueToday || 0}</span>
                    <span className="stat-label">{t('profile.review_due_today', {}, 'À réviser aujourd\'hui')}</span>
                  </div>
                  <div className="stat-item card-elevated">
                    <span className="stat-value">{reviewStats?.totalInReviewSystem || 0}</span>
                    <span className="stat-label">{t('profile.review_in_system', {}, 'Espèces en révision')}</span>
                  </div>
                  <div className="stat-item card-elevated">
                    <span className="stat-value">{profile?.stats?.reviewSessionsCompleted || 0}</span>
                    <span className="stat-label">{t('profile.review_sessions', {}, 'Sessions de révision')}</span>
                  </div>
                </div>
              </div>

              <div className="profile-section">
                <h3>{t('profile.mastery_title')}</h3>
                {isLoadingMastery ? (
                  <div className="mastery-loading" aria-label={t('profile.mastery_loading')}>
                    <Spinner />
                  </div>
                ) : (
                  <ul className="mastery-list mastery-grid">
                    {masteryDetails.map(({ id, taxon, count }) => (
                      <MasteryItem
                        key={id}
                        taxon={taxon}
                        count={count}
                        getDisplayNames={getTaxonDisplayNames}
                        t={t}
                      />
                    ))}
                    {sortedMastery.length === 0 && <p className="empty-state">{t('profile.mastery_empty')}</p>}
                  </ul>
                )}
              </div>
            </div>
          )}

          {activeTab === 'achievements' && (
            <div
              className="profile-section fade-in"
              id="tab-achievements"
              role="tabpanel"
              aria-live="polite"
              aria-labelledby="tab-achievements-trigger"
            >
              <div className="achievements-header">
                <h3>
                  {t('profile.achievements_title', {
                    count: unlockedAchievements.length,
                    total: Object.keys(ACHIEVEMENTS).length,
                  })}
                </h3>
              </div>

              {/* Catégorie: Taxonomie */}
              {achievementsByCategory[ACHIEVEMENT_CATEGORIES.TAXONOMY].length > 0 && (
                <div className="achievement-category">
                  <button
                    type="button"
                    className="category-header"
                    onClick={() => toggleCategory(ACHIEVEMENT_CATEGORIES.TAXONOMY)}
                    aria-expanded={openCategories[ACHIEVEMENT_CATEGORIES.TAXONOMY]}
                    aria-controls="achievement-category-taxonomy"
                  >
                    <span className="category-title">
                      <span className="category-icon">🔬</span>
                      {t('achievements.categories.taxonomy')}
                    </span>
                    <span className="category-chevron" aria-hidden="true">
                      {openCategories[ACHIEVEMENT_CATEGORIES.TAXONOMY] ? '▾' : '▸'}
                    </span>
                  </button>
                  {openCategories[ACHIEVEMENT_CATEGORIES.TAXONOMY] && (
                    <ul className="achievements-grid" id="achievement-category-taxonomy">
                      {achievementsByCategory[ACHIEVEMENT_CATEGORIES.TAXONOMY].map((achievement) => {
                        const unlocked = unlockedAchievements.includes(achievement.id);
                        const reward = getRewardForAchievement(achievement.id);
                        return (
                          <AchievementCard
                            key={achievement.id}
                            achievement={achievement}
                            unlocked={unlocked}
                            reward={reward}
                            t={t}
                          />
                        );
                      })}
                    </ul>
                  )}
                </div>
              )}

              {/* Catégorie: Collection */}
              {achievementsByCategory[ACHIEVEMENT_CATEGORIES.COLLECTION].length > 0 && (
                <div className="achievement-category">
                  <button
                    type="button"
                    className="category-header"
                    onClick={() => toggleCategory(ACHIEVEMENT_CATEGORIES.COLLECTION)}
                    aria-expanded={openCategories[ACHIEVEMENT_CATEGORIES.COLLECTION]}
                    aria-controls="achievement-category-collection"
                  >
                    <span className="category-title">
                      <span className="category-icon">📚</span>
                      {t('achievements.categories.collection')}
                    </span>
                    <span className="category-chevron" aria-hidden="true">
                      {openCategories[ACHIEVEMENT_CATEGORIES.COLLECTION] ? '▾' : '▸'}
                    </span>
                  </button>
                  {openCategories[ACHIEVEMENT_CATEGORIES.COLLECTION] && (
                    <ul className="achievements-grid" id="achievement-category-collection">
                      {achievementsByCategory[ACHIEVEMENT_CATEGORIES.COLLECTION].map((achievement) => {
                        const unlocked = unlockedAchievements.includes(achievement.id);
                        const reward = getRewardForAchievement(achievement.id);
                        return (
                          <AchievementCard
                            key={achievement.id}
                            achievement={achievement}
                            unlocked={unlocked}
                            reward={reward}
                            t={t}
                          />
                        );
                      })}
                    </ul>
                  )}
                </div>
              )}

              {/* Catégorie: Compétence */}
              {achievementsByCategory[ACHIEVEMENT_CATEGORIES.SKILL].length > 0 && (
                <div className="achievement-category">
                  <button
                    type="button"
                    className="category-header"
                    onClick={() => toggleCategory(ACHIEVEMENT_CATEGORIES.SKILL)}
                    aria-expanded={openCategories[ACHIEVEMENT_CATEGORIES.SKILL]}
                    aria-controls="achievement-category-skill"
                  >
                    <span className="category-title">
                      <span className="category-icon">⚡</span>
                      {t('achievements.categories.skill')}
                    </span>
                    <span className="category-chevron" aria-hidden="true">
                      {openCategories[ACHIEVEMENT_CATEGORIES.SKILL] ? '▾' : '▸'}
                    </span>
                  </button>
                  {openCategories[ACHIEVEMENT_CATEGORIES.SKILL] && (
                    <ul className="achievements-grid" id="achievement-category-skill">
                      {achievementsByCategory[ACHIEVEMENT_CATEGORIES.SKILL].map((achievement) => {
                        const unlocked = unlockedAchievements.includes(achievement.id);
                        const reward = getRewardForAchievement(achievement.id);
                        return (
                          <AchievementCard
                            key={achievement.id}
                            achievement={achievement}
                            unlocked={unlocked}
                            reward={reward}
                            t={t}
                          />
                        );
                      })}
                    </ul>
                  )}
                </div>
              )}

              {/* Catégorie: Habitudes */}
              {achievementsByCategory[ACHIEVEMENT_CATEGORIES.HABIT].length > 0 && (
                <div className="achievement-category">
                  <button
                    type="button"
                    className="category-header"
                    onClick={() => toggleCategory(ACHIEVEMENT_CATEGORIES.HABIT)}
                    aria-expanded={openCategories[ACHIEVEMENT_CATEGORIES.HABIT]}
                    aria-controls="achievement-category-habit"
                  >
                    <span className="category-title">
                      <span className="category-icon">📅</span>
                      {t('achievements.categories.habit')}
                    </span>
                    <span className="category-chevron" aria-hidden="true">
                      {openCategories[ACHIEVEMENT_CATEGORIES.HABIT] ? '▾' : '▸'}
                    </span>
                  </button>
                  {openCategories[ACHIEVEMENT_CATEGORIES.HABIT] && (
                    <ul className="achievements-grid" id="achievement-category-habit">
                      {achievementsByCategory[ACHIEVEMENT_CATEGORIES.HABIT].map((achievement) => {
                        const unlocked = unlockedAchievements.includes(achievement.id);
                        const reward = getRewardForAchievement(achievement.id);
                        return (
                          <AchievementCard
                            key={achievement.id}
                            achievement={achievement}
                            unlocked={unlocked}
                            reward={reward}
                            t={t}
                          />
                        );
                      })}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Profile Configurator Modal */}
      <ProfileConfigurator
        isOpen={isConfiguratorOpen}
        onClose={handleCloseConfigurator}
        onSave={handleSaveProfileChanges}
        profile={profile}
        displayName={displayName}
      />

      {isResetModalOpen && (
        <Modal onClose={handleCloseResetModal}>
          <h3 className="modal-title">{t('profile.reset_button')}</h3>
          <p>{t('profile.reset_confirm')}</p>
          <div className="modal-actions">
            <button className="action-button reset-profile-button" onClick={confirmResetProfile}>
              {t('profile.reset_button')}
            </button>
            <button className="action-button modal-cancel-button" onClick={handleCloseResetModal}>
              {t('common.cancel')}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default ProfilePage;
