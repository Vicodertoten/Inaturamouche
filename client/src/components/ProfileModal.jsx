import React, { useState, useEffect } from 'react';
import { ACHIEVEMENTS } from '../achievements';
import './ProfileModal.css';
import { getTaxaByIds } from '../services/api';

// --- Fonctions de calcul pour le système de niveaux ---
const getLevelFromXp = (xp) => {
  return 1 + Math.floor(Math.sqrt(xp || 0) / 10);
};

const getXpForLevel = (level) => {
  return Math.pow((level - 1) * 10, 2);
};

// Ce composant est correct, on n'y touche pas.
const MasteryItem = ({ taxon, count }) => {
  if (!taxon) {
    return null;
  }
  const taxonName = taxon.preferred_common_name || taxon.name;
  return (
    <li className="mastery-item">
      <span className="mastery-name">{taxonName}</span>
      <span className="mastery-count">Maîtrisé {count} fois</span>
    </li>
  );
};


function ProfileModal({ profile, onClose }) {
  const [activeTab, setActiveTab] = useState('summary');
  const [masteryDetails, setMasteryDetails] = useState([]);
  const [isLoadingMastery, setIsLoadingMastery] = useState(false);

  if (!profile) return null;

  const sortedMastery = Object.entries(profile.stats.speciesMastery || {})
                              .sort(([,a],[,b]) => b - a)
                              .slice(0, 5);

  useEffect(() => {
    if (activeTab === 'stats' && sortedMastery.length > 0 && masteryDetails.length === 0) {
      const fetchMasteryDetails = async () => {
        setIsLoadingMastery(true);
        const idsToFetch = sortedMastery.map(([id]) => id);
        try {
          const taxaData = await getTaxaByIds(idsToFetch);
          
          // --- CORRECTION 1 : On conserve l'ID dans notre nouvel objet ---
          const detailsWithCount = sortedMastery.map(([id, count]) => {
            const taxonDetail = taxaData.find(t => t.id == id);
            // On retourne un objet qui contient l'ID, le taxon, et le compteur.
            return { id, taxon: taxonDetail, count };
          });

          setMasteryDetails(detailsWithCount);
        } catch (error) {
          console.error("Erreur chargement des espèces maîtrisées:", error);
        }
        setIsLoadingMastery(false);
      };
      fetchMasteryDetails();
    }
    // --- CORRECTION 2 : Tableau des dépendances optimisé ---
    // On ne dépend que de l'onglet actif et de la source des données.
  }, [activeTab, profile.stats.speciesMastery]);

  // ... (le reste des calculs est inchangé)
  const level = getLevelFromXp(profile.xp);
  const xpForCurrentLevel = getXpForLevel(level);
  const xpForNextLevel = getXpForLevel(level + 1);
  const xpProgress = profile.xp - xpForCurrentLevel;
  const xpNeededForLevel = xpForNextLevel - xpForCurrentLevel;
  const progressPercentage = xpNeededForLevel > 0 ? (xpProgress / xpNeededForLevel) * 100 : 100;

  const totalAnswered = (profile.stats.easyQuestionsAnswered || 0) + (profile.stats.hardQuestionsAnswered || 0);
  const totalCorrect = (profile.stats.correctEasy || 0) + (profile.stats.correctHard || 0);
  const overallAccuracy = totalAnswered > 0 ? ((totalCorrect / totalAnswered) * 100).toFixed(1) : "0.0";

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content profile-modal" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="close-button" title="Fermer" aria-label="Fermer">×</button>
        <h2 className="modal-title">Profil du Joueur</h2>

        <div className="tabs-container">
          <button className={`tab-button ${activeTab === 'summary' ? 'active' : ''}`} onClick={() => setActiveTab('summary')}>Résumé</button>
          <button className={`tab-button ${activeTab === 'stats' ? 'active' : ''}`} onClick={() => setActiveTab('stats')}>Statistiques</button>
          <button className={`tab-button ${activeTab === 'achievements' ? 'active' : ''}`} onClick={() => setActiveTab('achievements')}>Succès</button>
        </div>

        <div className="tab-content">
          {activeTab === 'summary' && (
            <div className="fade-in">
              <div className="profile-section level-section">
                {/* CORRIGÉ : On affiche le niveau calculé */}
                <h3>Niveau {level}</h3>
                <div className="xp-bar-container">
                  <div className="xp-bar" style={{ width: `${progressPercentage}%` }}></div>
                </div>
                <div className="xp-label">
                  <span>{xpProgress.toLocaleString()} / {xpNeededForLevel.toLocaleString()} XP</span>
                </div>
              </div>
              <div className="profile-section">
                <h3>Statistiques Clés</h3>
                <div className="stats-grid summary-grid">
                  <div className="stat-item"><span className="stat-value">{profile.xp.toLocaleString()}</span><span className="stat-label">XP Total</span></div>
                  <div className="stat-item"><span className="stat-value">{profile.stats.gamesPlayed || 0}</span><span className="stat-label">Parties Jouées</span></div>
                  <div className="stat-item"><span className="stat-value">{overallAccuracy}%</span><span className="stat-label">Précision Globale</span></div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'stats' && (
            <div className="fade-in">
              <div className="profile-section">
                <h3>Maîtrise (Top 5)</h3>
                {isLoadingMastery ? <p>Chargement...</p> : (
                  <ul className="mastery-list">
                    {/* --- CORRECTION 3 : On peut maintenant utiliser l'ID en toute sécurité --- */}
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
                <h3>Succès ({profile.achievements.length} / {Object.keys(ACHIEVEMENTS).length})</h3>
                <ul className="achievements-list">
                   {Object.entries(ACHIEVEMENTS).map(([id, achievement]) => {
                      const isUnlocked = profile.achievements.includes(id);
                      return (
                        <li key={id} className={`achievement-item ${isUnlocked ? 'unlocked' : 'locked'}`}>
                          <div className="achievement-icon">{isUnlocked ? '🏆' : '🔒'}</div>
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
}

export default ProfileModal;