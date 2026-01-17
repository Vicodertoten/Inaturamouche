import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ACHIEVEMENTS,
  ACHIEVEMENT_CATEGORIES,
  REWARD_TYPES,
  getAllTitlesWithStatus, 
  getAllBordersWithStatus,
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
import '../components/ProfileModal.css';
import { useLanguage } from '../context/LanguageContext.jsx';
import { usePacks } from '../context/PacksContext.jsx';
import Modal from '../components/Modal';
import Spinner from '../components/Spinner';
import { getLevelFromXp, getXpForLevel } from '../utils/scoring';

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
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [isCustomizeModalOpen, setIsCustomizeModalOpen] = useState(false);

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
      (profile?.stats?.easyQuestionsAnswered || 0) + (profile?.stats?.hardQuestionsAnswered || 0);
    const totalCorrect = (profile?.stats?.correctEasy || 0) + (profile?.stats?.correctHard || 0);
    return {
      totalAnswered,
      totalCorrect,
      overallAccuracy: totalAnswered > 0 ? ((totalCorrect / totalAnswered) * 100).toFixed(1) : '0.0',
      easyAccuracy: ((profile?.stats?.accuracyEasy || 0) * 100).toFixed(1),
      hardAccuracy: ((profile?.stats?.accuracyHard || 0) * 100).toFixed(1),
    };
  }, [
    profile?.stats?.accuracyEasy,
    profile?.stats?.accuracyHard,
    profile?.stats?.correctEasy,
    profile?.stats?.correctHard,
    profile?.stats?.easyQuestionsAnswered,
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
  const avatarLetter = useMemo(() => (displayName ? displayName.charAt(0).toUpperCase() : 'E'), [displayName]);

  useEffect(() => {
    setEditedName(profile?.name || profile?.username || '');
  }, [profile?.name, profile?.username]);

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
    setIsEditingName(false);
  }, [refreshProfile]);

  const handleBack = useCallback(() => {
    const historyState = window.history.state || {};
    const canGoBack =
      typeof historyState.idx === 'number' ? historyState.idx > 0 : window.history.length > 1;
    if (canGoBack) navigate(-1);
    else navigate('/', { replace: true });
  }, [navigate]);

  const handleStartEditName = useCallback(() => {
    setEditedName(profile?.name || profile?.username || '');
    setIsEditingName(true);
  }, [profile?.name, profile?.username]);

  const handleCancelEditName = useCallback(() => {
    setEditedName(profile?.name || profile?.username || '');
    setIsEditingName(false);
  }, [profile?.name, profile?.username]);

  const handleSaveName = useCallback(() => {
    const trimmedName = (editedName || '').trim();
    if (!trimmedName) {
      handleCancelEditName();
      return;
    }
    updateProfile((prev) => ({ ...prev, name: trimmedName }));
    setIsEditingName(false);
  }, [editedName, handleCancelEditName, updateProfile]);

  // Gestion de la personnalisation (titres et bordures)
  const handleOpenCustomize = useCallback(() => {
    setIsCustomizeModalOpen(true);
  }, []);

  const handleCloseCustomize = useCallback(() => {
    setIsCustomizeModalOpen(false);
  }, []);

  const handleEquipTitle = useCallback((titleId) => {
    updateProfile((prev) => ({
      ...prev,
      rewards: {
        ...prev.rewards,
        equippedTitle: titleId,
      },
    }));
  }, [updateProfile]);

  const handleEquipBorder = useCallback((borderId) => {
    updateProfile((prev) => ({
      ...prev,
      rewards: {
        ...prev.rewards,
        equippedBorder: borderId,
      },
    }));
  }, [updateProfile]);

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

  // Titres et bordures disponibles avec statut de déverrouillage
  const titlesWithStatus = useMemo(() => {
    return getAllTitlesWithStatus(profile.achievements || []);
  }, [profile.achievements]);

  const bordersWithStatus = useMemo(() => {
    return getAllBordersWithStatus(profile.achievements || []);
  }, [profile.achievements]);

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

        <div className="profile-hero sticky-hero">
          <div className="hero-left">
            <div className={`avatar-ring ${borderCss}`} aria-label={t('profile.title')}>
              <span className="avatar-letter">{avatarLetter}</span>
            </div>
            <div className="hero-meta">
              {/* Titre équipé */}
              {titleDetails && equippedTitle !== 'default' && (
                <p className="equipped-title">{titleDetails.value || t(titleDetails.nameKey)}</p>
              )}
              <p className="eyebrow">{t('common.profile')}</p>
              {isEditingName ? (
                <div className="name-editor">
                  <input
                    type="text"
                    className="name-input"
                    value={editedName}
                    onChange={(e) => setEditedName(e.target.value)}
                    placeholder={t('profile.title')}
                    aria-label={t('profile.edit_name')}
                    autoFocus
                  />
                  <div className="name-actions">
                    <button className="action-button name-action-button" onClick={handleSaveName}>
                      {t('common.save')}
                    </button>
                    <button
                      className="action-button name-action-button ghost"
                      onClick={handleCancelEditName}
                    >
                      {t('common.cancel')}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="name-row">
                  <h2 className="player-name">{displayName}</h2>
                  <button
                    type="button"
                    className="edit-name-button nav-pill nav-icon nav-elevated"
                    onClick={handleStartEditName}
                    aria-label={t('profile.edit_name')}
                    title={t('profile.edit_name')}
                  >
                    ✎
                  </button>
                </div>
              )}
              <div className="level-chip">
                <span className="level-label">{t('profile.level', { level: levelInfo.level })}</span>
                <span className="level-number">#{levelInfo.level}</span>
              </div>
            </div>
          </div>
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

        <div className="tabs-container pill-tabs" role="tablist" aria-label={t('profile.title')}>
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
              <DailyStreakBadge />

              <ProfileStreakCard
                currentStreak={profile.stats.lastSessionStreak || 0}
                longestStreak={profile.stats.longestStreak || 0}
              />

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
                <button 
                  className="action-button customize-button"
                  onClick={handleOpenCustomize}
                  aria-label={t('profile.customize_profile')}
                >
                  ✨ {t('profile.customize_profile')}
                </button>
              </div>

              {/* Catégorie: Taxonomie */}
              {achievementsByCategory[ACHIEVEMENT_CATEGORIES.TAXONOMY].length > 0 && (
                <div className="achievement-category">
                  <h4 className="category-header">
                    <span className="category-icon">🔬</span>
                    {t('achievements.categories.taxonomy')}
                  </h4>
                  <ul className="achievements-grid">
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
                </div>
              )}

              {/* Catégorie: Collection */}
              {achievementsByCategory[ACHIEVEMENT_CATEGORIES.COLLECTION].length > 0 && (
                <div className="achievement-category">
                  <h4 className="category-header">
                    <span className="category-icon">📚</span>
                    {t('achievements.categories.collection')}
                  </h4>
                  <ul className="achievements-grid">
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
                </div>
              )}

              {/* Catégorie: Compétence */}
              {achievementsByCategory[ACHIEVEMENT_CATEGORIES.SKILL].length > 0 && (
                <div className="achievement-category">
                  <h4 className="category-header">
                    <span className="category-icon">⚡</span>
                    {t('achievements.categories.skill')}
                  </h4>
                  <ul className="achievements-grid">
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
                </div>
              )}

              {/* Catégorie: Habitudes */}
              {achievementsByCategory[ACHIEVEMENT_CATEGORIES.HABIT].length > 0 && (
                <div className="achievement-category">
                  <h4 className="category-header">
                    <span className="category-icon">📅</span>
                    {t('achievements.categories.habit')}
                  </h4>
                  <ul className="achievements-grid">
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
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modal de personnalisation */}
      {isCustomizeModalOpen && (
        <Modal onClose={handleCloseCustomize}>
          <div className="customization-modal">
            <h3 className="modal-title">{t('profile.customize_profile')}</h3>
            
            {/* Sélection du titre */}
            <div className="customization-section">
              <h4>{t('profile.select_title')}</h4>
              <div className="options-grid">
                {titlesWithStatus.map((title) => (
                  <div
                    key={title.id}
                    className={`option-item ${title.id === equippedTitle ? 'selected' : ''} ${!title.unlocked ? 'locked' : ''}`}
                    onClick={() => title.unlocked && handleEquipTitle(title.id)}
                    role="button"
                    tabIndex={title.unlocked ? 0 : -1}
                    aria-selected={title.id === equippedTitle}
                    aria-disabled={!title.unlocked}
                  >
                    <span className="title-preview">
                      {title.value || t(title.nameKey)}
                    </span>
                    <span className="option-label">
                      {title.value || t(title.nameKey)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Sélection de la bordure */}
            <div className="customization-section">
              <h4>{t('profile.select_border')}</h4>
              <div className="options-grid">
                {bordersWithStatus.map((border) => (
                  <div
                    key={border.id}
                    className={`option-item ${border.id === equippedBorder ? 'selected' : ''} ${!border.unlocked ? 'locked' : ''}`}
                    onClick={() => border.unlocked && handleEquipBorder(border.id)}
                    role="button"
                    tabIndex={border.unlocked ? 0 : -1}
                    aria-selected={border.id === equippedBorder}
                    aria-disabled={!border.unlocked}
                  >
                    <div className={`border-preview ${border.css || ''}`}>
                      <span className="preview-letter">{avatarLetter}</span>
                    </div>
                    <span className="option-label">
                      {t(border.nameKey)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <button className="action-button" onClick={handleCloseCustomize}>
              {t('common.ok')}
            </button>
          </div>
        </Modal>
      )}

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
