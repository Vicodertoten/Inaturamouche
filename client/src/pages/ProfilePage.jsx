import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { useLanguage } from '../context/LanguageContext.jsx';
import { notify } from '../services/notifications.js';
import { resetProfile } from '../services/PlayerProfile';
import ProfileConfigurator from '../components/ProfileConfigurator';
import ProfileHero from '../components/ProfileHero';
import ProfileStatsModal from '../components/ProfileStatsModal';
import AchievementGrid from '../components/AchievementGrid';
import Modal from '../components/Modal';
import { buildCollectionSnapshot, encodeCollectionSnapshot, buildCollectionUrl } from '../utils/collectionShare';
import { copyToClipboard } from '../utils/shareCard';
import '../components/ProfileModal.css';

const ProfilePage = () => {
  const navigate = useNavigate();
  const { profile, refreshProfile, updateProfile } = useUser();
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState('summary');
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [isConfiguratorOpen, setIsConfiguratorOpen] = useState(false);
  const [isStatsModalOpen, setIsStatsModalOpen] = useState(false);

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
      overallAccuracy: totalAnswered > 0 ? ((totalCorrect / totalAnswered) * 100).toFixed(1) : '0.0',
      easyAccuracy: ((profile?.stats?.accuracyEasy || 0) * 100).toFixed(1),
      riddleAccuracy: ((profile?.stats?.accuracyRiddle || 0) * 100).toFixed(1),
      hardAccuracy: ((profile?.stats?.accuracyHard || 0) * 100).toFixed(1),
      totalAnswered,
      totalCorrect,
    };
  }, [
    profile?.stats?.accuracyEasy,
    profile?.stats?.accuracyHard,
    profile?.stats?.accuracyRiddle,
    profile?.stats?.correctEasy,
    profile?.stats?.correctHard,
    profile?.stats?.correctRiddle,
    profile?.stats?.easyQuestionsAnswered,
    profile?.stats?.riddleQuestionsAnswered,
    profile?.stats?.hardQuestionsAnswered,
  ]);

  const handleBack = useCallback(() => {
    const historyState = window.history.state || {};
    const canGoBack =
      typeof historyState.idx === 'number' ? historyState.idx > 0 : window.history.length > 1;
    if (canGoBack) navigate(-1);
    else navigate('/', { replace: true });
  }, [navigate]);

  const confirmResetProfile = useCallback(() => {
    resetProfile();
    refreshProfile();
    setIsResetModalOpen(false);
  }, [refreshProfile]);

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

  if (!profile) {
    return (
      <div className="screen profile-screen">
        <div className="card"><p>{t('profile.loading')}</p></div>
      </div>
    );
  }

  const unlockedAchievements = profile.achievements || [];
  const displayName = profile?.name || profile?.username || t('profile.title');

  return (
    <div className="screen profile-screen">
      <h1 className="sr-only">{t('profile.title')}</h1>
      <div className="profile-modal profile-page-card profile-dashboard">
        <button className="back-button" onClick={handleBack} aria-label={t('profile.back')}>
          {t('profile.back')}
        </button>

        <ProfileHero profile={profile} onEdit={() => setIsConfiguratorOpen(true)} />

        {/* ── Tabs ── */}
        <div className="tabs-container pill-tabs tutorial-profile-tabs" role="tablist" aria-label={t('profile.title')}>
          <button
            className={`tab-button pill ${activeTab === 'summary' ? 'active' : ''}`}
            onClick={() => setActiveTab('summary')}
            role="tab"
            aria-selected={activeTab === 'summary'}
          >
            {t('profile.tabs.summary')}
          </button>
          <button
            className={`tab-button pill ${activeTab === 'achievements' ? 'active' : ''}`}
            onClick={() => setActiveTab('achievements')}
            role="tab"
            aria-selected={activeTab === 'achievements'}
          >
            {t('profile.tabs.achievements')}
          </button>
        </div>

        {/* ── Tab content ── */}
        <div className="tab-content">
          {activeTab === 'summary' && (
            <div className="fade-in" role="tabpanel" aria-live="polite">
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
                <button
                  className="action-button stats-detail-button"
                  onClick={() => setIsStatsModalOpen(true)}
                  type="button"
                >
                  📊 {t('profile.detailed_stats', {}, 'Statistiques détaillées')}
                </button>
                <button
                  className="action-button share-collection-button"
                  onClick={async () => {
                    const snapshot = buildCollectionSnapshot(profile);
                    const token = encodeCollectionSnapshot(snapshot);
                    if (token) {
                      const url = buildCollectionUrl(token);
                      const ok = await copyToClipboard(url);
                      if (ok) notify(t('collection_share.link_copied', {}, 'Lien de collection copié !'), { type: 'success', duration: 3000 });
                    }
                  }}
                  type="button"
                >
                  🔗 {t('profile.share_collection', {}, 'Partager ma collection')}
                </button>
              </div>

              <div className="profile-section profile-reset-section">
                <button className="action-button reset-profile-button" onClick={() => setIsResetModalOpen(true)}>
                  {t('profile.reset_button')}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'achievements' && (
            <AchievementGrid unlockedAchievements={unlockedAchievements} />
          )}
        </div>
      </div>

      {/* Profile Configurator Modal */}
      <ProfileConfigurator
        isOpen={isConfiguratorOpen}
        onClose={() => setIsConfiguratorOpen(false)}
        onSave={handleSaveProfileChanges}
        profile={profile}
        displayName={displayName}
      />

      {isStatsModalOpen && (
        <ProfileStatsModal
          profile={profile}
          accuracyStats={accuracyStats}
          onClose={() => setIsStatsModalOpen(false)}
        />
      )}

      {isResetModalOpen && (
        <Modal onClose={() => setIsResetModalOpen(false)}>
          <h3 className="modal-title">{t('profile.reset_button')}</h3>
          <p>{t('profile.reset_confirm')}</p>
          <div className="modal-actions">
            <button className="action-button reset-profile-button" onClick={confirmResetProfile}>
              {t('profile.reset_button')}
            </button>
            <button className="action-button modal-cancel-button" onClick={() => setIsResetModalOpen(false)}>
              {t('common.cancel')}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default ProfilePage;
