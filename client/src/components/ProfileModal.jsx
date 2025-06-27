import React from 'react';
import { ACHIEVEMENTS } from '../achievements'; // On importe la liste des succès
import './ProfileModal.css'; // On importe le CSS dédié

function ProfileModal({ profile, onClose }) {
  if (!profile) return null; // Sécurité si le profil n'est pas encore chargé

  return (
    // Le fond assombri. Un clic dessus ferme la modale.
    <div className="modal-backdrop" onClick={onClose}>
      {/* Le contenu de la fiche. Le e.stopPropagation() empêche un clic à l'intérieur de fermer la modale. */}
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="close-button" title="Fermer">×</button>
        
        <h2 className="modal-title">Profil du Joueur</h2>

        {/* --- Section Statistiques --- */}
        <div className="profile-section">
          <h3>Statistiques</h3>
          <div className="stats-grid">
            <div className="stat-item">
              <span className="stat-value">{profile.totalScore.toLocaleString()}</span>
              <span className="stat-label">Score Total</span>
            </div>
            <div className="stat-item">
              <span className="stat-value">{profile.stats.gamesPlayed || 0}</span>
              <span className="stat-label">Parties Jouées</span>
            </div>
            <div className="stat-item">
              <span className="stat-value">{profile.stats.questionsAnswered || 0}</span>
              <span className="stat-label">Questions Vues</span>
            </div>
            <div className="stat-item">
              <span className="stat-value">{profile.stats.correctEasy || 0}</span>
              <span className="stat-label">Bonnes réponses (Facile)</span>
            </div>
            <div className="stat-item">
              <span className="stat-value">{profile.stats.correctHard || 0}</span>
              <span className="stat-label">Bonnes réponses (Difficile)</span>
            </div>
          </div>
        </div>

        {/* --- Section Succès --- */}
        <div className="profile-section">
          <h3>Succès Débloqués ({profile.achievements.length} / {Object.keys(ACHIEVEMENTS).length})</h3>
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

      </div>
    </div>
  );
}

export default ProfileModal;