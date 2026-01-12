import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ACHIEVEMENTS } from '../achievements';
import { useUser } from '../context/UserContext';
import { getTaxaByIds } from '../services/api';
import { notify } from '../services/notifications.js';
import { resetProfile } from '../services/PlayerProfile';
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

const ProfilePage = () => {
  const navigate = useNavigate();
  const { profile, refreshProfile, updateProfile } = useUser();
  const { t, getTaxonDisplayNames, language } = useLanguage();
  const { packs } = usePacks();
  const [activeTab, setActiveTab] = useState('summary');
  const [masteryDetails, setMasteryDetails] = useState([]);
  const [isLoadingMastery, setIsLoadingMastery] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState('');

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

  return (
    <div className="screen profile-screen">
      <div className="profile-modal profile-page-card profile-dashboard">
        <button className="back-button" onClick={handleBack} aria-label={t('profile.back')}>
          {t('profile.back')}
        </button>

        <div className="profile-hero sticky-hero">
          <div className="hero-left">
            <div className="avatar-ring" aria-label={t('profile.title')}>
              <span className="avatar-letter">{avatarLetter}</span>
            </div>
            <div className="hero-meta">
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
            <div className="xp-bar-container xp-bar-hero" aria-label={t('profile.xp_counter', { current: levelInfo.xpProgress.toLocaleString(), total: levelInfo.xpNeededForLevel.toLocaleString() })}>
              <div className="xp-bar" style={{ width: `${levelInfo.progressPercentage}%` }}></div>
              <div className="xp-shine" />
            </div>
            <div className="xp-label hero-xp-label">
              <span>
                {t('profile.xp_counter', {
                  current: levelInfo.xpProgress.toLocaleString(),
                  total: levelInfo.xpNeededForLevel.toLocaleString(),
                })}
              </span>
              <span className="xp-total">XP: {profile.xp.toLocaleString()}</span>
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
              <h3>
                {t('profile.achievements_title', {
                  count: unlockedAchievements.length,
                  total: Object.keys(ACHIEVEMENTS).length,
                })}
              </h3>
              <ul className="achievements-grid">
                {Object.entries(ACHIEVEMENTS).map(([id, achievement]) => {
                  const unlocked = unlockedAchievements.includes(id);
                  return (
                    <li
                      key={id}
                      className={`achievement-card ${unlocked ? 'unlocked' : 'locked'}`}
                      aria-label={achievement.titleKey ? t(achievement.titleKey) : id}
                    >
                      <div className="achievement-icon" aria-hidden="true">
                        {achievement.icon}
                      </div>
                      <div className="achievement-details">
                        <h4 className="achievement-title">
                          {achievement.titleKey ? t(achievement.titleKey) : id}
                        </h4>
                        {achievement.descriptionKey && (
                          <p className="achievement-description">{t(achievement.descriptionKey)}</p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      </div>
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
