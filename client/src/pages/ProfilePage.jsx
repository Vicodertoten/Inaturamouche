import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ACHIEVEMENTS } from '../achievements';
import { useUser } from '../context/UserContext';
import { getTaxaByIds } from '../services/api';
import PACKS from '../../../shared/packs.js';
import { resetProfile } from '../services/PlayerProfile';
import '../components/ProfileModal.css';

const getLevelFromXp = (xp) => 1 + Math.floor(Math.sqrt(xp || 0) / 10);
const getXpForLevel = (level) => Math.pow((level - 1) * 10, 2);

const MasteryItem = ({ taxon, count }) => {
  if (!taxon) return null;
  const taxonName = taxon.preferred_common_name || taxon.name;
  return (
    <li className="mastery-item">
      <span className="mastery-name">{taxonName}</span>
      <span className="mastery-count">Maîtrisé {count} fois</span>
    </li>
  );
};

const ProfilePage = () => {
  const navigate = useNavigate();
  const { profile, refreshProfile } = useUser();
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
        const taxaData = await getTaxaByIds(idsToFetch);
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
  }, [activeTab, masteryDetails.length, profile, sortedMastery]);

  const handleResetProfile = useCallback(() => {
    if (window.confirm('Voulez-vous vraiment réinitialiser votre profil ?')) {
      resetProfile();
      refreshProfile();
    }
  }, [refreshProfile]);

  const handleBack = useCallback(() => {
    if (window.history.length > 1) navigate(-1);
    else navigate('/');
  }, [navigate]);

  if (!profile) {
    return (
      <div className="screen profile-screen">
        <div className="card">
          <p>Chargement du profil…</p>
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
          ← Retour
        </button>
        <h2 className="modal-title">Profil du Joueur</h2>

        <div className="tabs-container">
          <button
            className={`tab-button ${activeTab === 'summary' ? 'active' : ''}`}
            onClick={() => setActiveTab('summary')}
          >
            Résumé
          </button>
          <button
            className={`tab-button ${activeTab === 'stats' ? 'active' : ''}`}
            onClick={() => setActiveTab('stats')}
          >
            Statistiques
          </button>
          <button
            className={`tab-button ${activeTab === 'achievements' ? 'active' : ''}`}
            onClick={() => setActiveTab('achievements')}
          >
            Succès
          </button>
        </div>

        <div className="tab-content">
          {activeTab === 'summary' && (
            <div className="fade-in">
              <div className="profile-section level-section">
                <h3>Niveau {level}</h3>
                <div className="xp-bar-container">
                  <div className="xp-bar" style={{ width: `${progressPercentage}%` }}></div>
                </div>
                <div className="xp-label">
                  <span>
                    {xpProgress.toLocaleString()} / {xpNeededForLevel.toLocaleString()} XP
                  </span>
                </div>
              </div>

              <div className="profile-section">
                <h3>Statistiques Clés</h3>
                <div className="stats-grid summary-grid">
                  <div className="stat-item">
                    <span className="stat-value">{profile.xp.toLocaleString()}</span>
                    <span className="stat-label">XP Total</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-value">{profile.stats.gamesPlayed || 0}</span>
                    <span className="stat-label">Parties Jouées</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-value">{overallAccuracy}%</span>
                    <span className="stat-label">Précision Globale</span>
                  </div>
                </div>
              </div>

              <div className="profile-section">
                <button className="reset-profile-button" onClick={handleResetProfile}>
                  Réinitialiser le profil
                </button>
              </div>
            </div>
          )}

          {activeTab === 'stats' && (
            <div className="fade-in">
              <div className="profile-section">
                <h3>Précision par mode</h3>
                <div className="stats-grid">
                  <div className="stat-item">
                    <span className="stat-value">{easyAccuracy}%</span>
                    <span className="stat-label">Mode Facile</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-value">{hardAccuracy}%</span>
                    <span className="stat-label">Mode Difficile</span>
                  </div>
                </div>
              </div>

              <div className="profile-section">
                <h3>Statistiques par Pack</h3>
                <ul className="pack-stats-list">
                  {Object.entries(profile.stats.packsPlayed || {}).map(([packId, { correct, answered }]) => {
                    const pack = PACKS.find((p) => p.id === packId);
                    const accuracy = answered > 0 ? ((correct / answered) * 100).toFixed(1) : '0.0';
                    return (
                      <li key={packId} className="pack-stat-item">
                        <span className="pack-name">{pack ? pack.title : packId}</span>
                        <span className="pack-count">{correct}/{answered} ({accuracy}%)</span>
                      </li>
                    );
                  })}
                  {Object.keys(profile.stats.packsPlayed || {}).length === 0 && (
                    <p className="empty-state">Aucun pack joué.</p>
                  )}
                </ul>
              </div>

              <div className="profile-section">
                <h3>Maîtrise (Top 5)</h3>
                {isLoadingMastery ? (
                  <p>Chargement...</p>
                ) : (
                  <ul className="mastery-list">
                    {masteryDetails.map(({ id, taxon, count }) => (
                      <MasteryItem key={id} taxon={taxon} count={count} />
                    ))}
                    {sortedMastery.length === 0 && <p className="empty-state">Aucune espèce maîtrisée.</p>}
                  </ul>
                )}
              </div>
            </div>
          )}

          {activeTab === 'achievements' && (
            <div className="profile-section fade-in">
              <h3>Succès ({unlockedAchievements.length} / {Object.keys(ACHIEVEMENTS).length})</h3>
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
                        <h4 className="achievement-title">{achievement.title}</h4>
                        <p className="achievement-description">{achievement.description}</p>
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
