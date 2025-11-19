import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ACHIEVEMENTS } from '../achievements';
import { useUser } from '../context/UserContext';
import { getTaxaByIds } from '../services/api';
import { resetProfile } from '../services/PlayerProfile';
import '../components/ProfileModal.css';
import { useLanguage } from '../context/LanguageContext.jsx';
import { usePacks } from '../context/PacksContext.jsx';

const getLevelFromXp = (xp) => 1 + Math.floor(Math.sqrt(xp || 0) / 10);
const getXpForLevel = (level) => Math.pow((level - 1) * 10, 2);

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
  const { profile, refreshProfile } = useUser();
  const { t, getTaxonDisplayNames, language } = useLanguage();
  const { packs } = usePacks();
  const [activeTab, setActiveTab] = useState('summary');
  const [masteryDetails, setMasteryDetails] = useState([]);
  const [isLoadingMastery, setIsLoadingMastery] = useState(false);

  const sortedMastery = useMemo(() => {
    return Object.entries(profile?.stats?.speciesMastery || {})
      .map(([id, data]) => [id, data.correct || 0])
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);
  }, [profile?.stats?.speciesMastery]);

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
        console.error('Erreur chargement des espèces maîtrisées:', error);
      }
      setIsLoadingMastery(false);
    };

    loadMastery();
  }, [activeTab, language, masteryDetails.length, profile, sortedMastery]);

  const handleResetProfile = useCallback(() => {
    if (window.confirm(t('profile.reset_confirm'))) {
      resetProfile();
      refreshProfile();
    }
  }, [refreshProfile, t]);

  const handleBack = useCallback(() => {
    if (window.history.length > 1) navigate(-1);
    else navigate('/');
  }, [navigate]);

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

  const level = getLevelFromXp(profile.xp);
  const xpForCurrentLevel = getXpForLevel(level);
  const xpForNextLevel = getXpForLevel(level + 1);
  const xpProgress = profile.xp - xpForCurrentLevel;
  const xpNeededForLevel = xpForNextLevel - xpForCurrentLevel;
  const progressPercentage = xpNeededForLevel > 0 ? (xpProgress / xpNeededForLevel) * 100 : 100;

  const totalAnswered = (profile.stats.easyQuestionsAnswered || 0) + (profile.stats.hardQuestionsAnswered || 0);
  const totalCorrect = (profile.stats.correctEasy || 0) + (profile.stats.correctHard || 0);
  const overallAccuracy = totalAnswered > 0 ? ((totalCorrect / totalAnswered) * 100).toFixed(1) : '0.0';
  const easyAccuracy = ((profile.stats.accuracyEasy || 0) * 100).toFixed(1);
  const hardAccuracy = ((profile.stats.accuracyHard || 0) * 100).toFixed(1);

  return (
    <div className="screen profile-screen">
      <div className="profile-modal profile-page-card">
        <button className="back-button" onClick={handleBack}>
          {t('profile.back')}
        </button>
        <h2 className="modal-title">{t('profile.title')}</h2>

        <div className="tabs-container">
          <button
            className={`tab-button ${activeTab === 'summary' ? 'active' : ''}`}
            onClick={() => setActiveTab('summary')}
          >
            {t('profile.tabs.summary')}
          </button>
          <button
            className={`tab-button ${activeTab === 'stats' ? 'active' : ''}`}
            onClick={() => setActiveTab('stats')}
          >
            {t('profile.tabs.stats')}
          </button>
          <button
            className={`tab-button ${activeTab === 'achievements' ? 'active' : ''}`}
            onClick={() => setActiveTab('achievements')}
          >
            {t('profile.tabs.achievements')}
          </button>
        </div>

        <div className="tab-content">
          {activeTab === 'summary' && (
            <div className="fade-in">
              <div className="profile-section level-section">
                <h3>{t('profile.level', { level })}</h3>
                <div className="xp-bar-container">
                  <div className="xp-bar" style={{ width: `${progressPercentage}%` }}></div>
                </div>
                <div className="xp-label">
                  <span>{t('profile.xp_counter', { current: xpProgress.toLocaleString(), total: xpNeededForLevel.toLocaleString() })}</span>
                </div>
              </div>

              <div className="profile-section">
                <h3>{t('profile.summary_title')}</h3>
                <div className="stats-grid summary-grid">
                  <div className="stat-item">
                    <span className="stat-value">{profile.xp.toLocaleString()}</span>
                    <span className="stat-label">{t('profile.stats_labels.xp')}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-value">{profile.stats.gamesPlayed || 0}</span>
                    <span className="stat-label">{t('profile.stats_labels.games')}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-value">{overallAccuracy}%</span>
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
            <div className="fade-in">
              <div className="profile-section">
                <h3>{t('profile.accuracy_title')}</h3>
                <div className="stats-grid">
                  <div className="stat-item">
                    <span className="stat-value">{easyAccuracy}%</span>
                    <span className="stat-label">{t('profile.modes.easy')}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-value">{hardAccuracy}%</span>
                    <span className="stat-label">{t('profile.modes.hard')}</span>
                  </div>
                </div>
              </div>

              <div className="profile-section">
                <h3>{t('profile.pack_stats_title')}</h3>
                <ul className="pack-stats-list">
                  {Object.entries(profile.stats.packsPlayed || {}).map(([packId, { correct, answered }]) => {
                    const pack = packs.find((p) => p.id === packId);
                    const accuracy = answered > 0 ? ((correct / answered) * 100).toFixed(1) : '0.0';
                    return (
                      <li key={packId} className="pack-stat-item">
                        <span className="pack-name">{pack?.titleKey ? t(pack.titleKey) : packId}</span>
                        <span className="pack-count">{t('profile.pack_accuracy', { correct, answered, accuracy })}</span>
                      </li>
                    );
                  })}
                  {Object.keys(profile.stats.packsPlayed || {}).length === 0 && (
                    <p className="empty-state">{t('profile.no_pack_stats')}</p>
                  )}
                </ul>
              </div>

              <div className="profile-section">
                <h3>{t('profile.mastery_title')}</h3>
                {isLoadingMastery ? (
                  <p>{t('profile.mastery_loading')}</p>
                ) : (
                  <ul className="mastery-list">
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
            <div className="profile-section fade-in">
              <h3>
                {t('profile.achievements_title', {
                  count: unlockedAchievements.length,
                  total: Object.keys(ACHIEVEMENTS).length,
                })}
              </h3>
              <ul className="achievements-list">
                {Object.entries(ACHIEVEMENTS).map(([id, achievement]) => {
                  const unlocked = unlockedAchievements.includes(id);
                  return (
                    <li
                      key={id}
                      className={`achievement-item ${unlocked ? 'unlocked' : 'locked'}`}
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
    </div>
  );
};

export default ProfilePage;
