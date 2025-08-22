import React from 'react';
import './ProfileModal.css';

function DetailedProfileModal({ profile, onClose }) {
  if (!profile) return null;

  const {
    averageTimeMs = 0,
    bestStreak = 0,
    categoryStats = {},
  } = profile.stats || {};

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content profile-modal" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={onClose}
          className="close-button"
          title="Fermer"
          aria-label="Fermer"
        >
          ×
        </button>
        <h2 className="modal-title">Profil détaillé</h2>

        <div className="profile-section">
          <h3>Métriques globales</h3>
          <div className="stats-grid">
            <div className="stat-item">
              <span className="stat-value">{Math.round(averageTimeMs)}</span>
              <span className="stat-label">Temps moyen (ms)</span>
            </div>
            <div className="stat-item">
              <span className="stat-value">{bestStreak}</span>
              <span className="stat-label">Meilleure série</span>
            </div>
          </div>
        </div>

        <div className="profile-section">
          <h3>Statistiques par catégorie</h3>
          <ul className="pack-stats-list">
            {Object.entries(categoryStats).map(([cat, { correct = 0, answered = 0 }]) => {
              const acc = answered > 0 ? ((correct / answered) * 100).toFixed(1) : '0.0';
              return (
                <li key={cat} className="pack-stat-item">
                  <span className="pack-name">{cat}</span>
                  <span className="pack-count">{correct}/{answered} ({acc}%)</span>
                </li>
              );
            })}
            {Object.keys(categoryStats).length === 0 && (
              <p className="empty-state">Aucune catégorie suivie.</p>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}

export default DetailedProfileModal;

