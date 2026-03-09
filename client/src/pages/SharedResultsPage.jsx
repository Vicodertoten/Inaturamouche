import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { decodeResultsSnapshot } from '../utils/resultsShare';
import { useLanguage } from '../context/LanguageContext.jsx';
import './SharedResultsPage.css';

const SharedResultsPage = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [snapshot, setSnapshot] = useState(null);
  const [error, setError] = useState(false);

  const decode = useCallback(() => {
    if (!token) { setError(true); return; }
    const decoded = decodeResultsSnapshot(token);
    if (!decoded) { setError(true); return; }
    setError(false);
    setSnapshot(decoded);
  }, [token]);

  useEffect(() => { decode(); }, [decode]);

  if (error) {
    return (
      <div className="screen shared-results-screen">
        <div className="card">
          <h1>❌ {t('results_share.invalid', {}, 'Résultats introuvables')}</h1>
          <p>{t('results_share.invalid_text', {}, 'Ce lien de résultats n\'est pas valide ou a expiré.')}</p>
          <button type="button" className="btn btn--primary" onClick={() => navigate('/')}>
            {t('common.home', {}, 'Accueil')}
          </button>
        </div>
      </div>
    );
  }

  if (!snapshot) {
    return (
      <div className="screen shared-results-screen">
        <div className="card" role="status" aria-live="polite">
          <p>{t('results_share.loading', {}, 'Chargement des résultats…')}</p>
        </div>
      </div>
    );
  }

  const accuracy = snapshot.q > 0 ? Math.round((snapshot.c / snapshot.q) * 100) : 0;
  const modeName = snapshot.m === 'hard' ? t('home.hard_mode', {}, 'Difficile') : t('home.easy_mode', {}, 'Facile');
  const dateStr = snapshot.t ? new Date(snapshot.t).toLocaleDateString() : '';

  return (
    <div className="screen shared-results-screen">
      <div className="card shared-results-card">
        <div className="shared-results-header">
          <h1 className="shared-results-name">{snapshot.n}</h1>
          <div className="shared-results-meta">
            <span>🏅 {t('xp.level_label', {}, 'Niveau')} {snapshot.l}</span>
            {dateStr && <span>📅 {dateStr}</span>}
          </div>
        </div>

        <div className="shared-results-summary">
          <div className="shared-results-stat shared-results-stat--primary">
            <span className="stat-value">{snapshot.c}/{snapshot.q}</span>
            <span className="stat-label">{t('results_share.correct', {}, 'Bonnes réponses')}</span>
          </div>
          <div className="shared-results-stat">
            <span className="stat-value">{accuracy}%</span>
            <span className="stat-label">{t('results_share.accuracy', {}, 'Précision')}</span>
          </div>
          <div className="shared-results-stat">
            <span className="stat-value">{snapshot.s}</span>
            <span className="stat-label">{t('results_share.score', {}, 'Score')}</span>
          </div>
          <div className="shared-results-stat">
            <span className="stat-value">+{snapshot.xp}</span>
            <span className="stat-label">XP</span>
          </div>
        </div>

        <div className="shared-results-config">
          {snapshot.pn && <span className="shared-results-chip">📦 {snapshot.pn}</span>}
          <span className="shared-results-chip">🎯 {modeName}</span>
          {snapshot.r === 1 && <span className="shared-results-chip">📚 {t('review.title', {}, 'Révision')}</span>}
        </div>

        {snapshot.sp && snapshot.sp.length > 0 && (
          <>
            <h3 className="shared-results-species-title">
              {t('results_share.species_title', { count: snapshot.sp.length }, `${snapshot.sp.length} espèces rencontrées`)}
            </h3>
            <ul className="shared-results-species-list">
              {snapshot.sp.map(([taxonId, wasCorrect, commonName, sciName], idx) => (
                <li key={`${taxonId}-${idx}`} className={`shared-results-species ${wasCorrect ? 'correct' : 'wrong'}`}>
                  <span className="species-status">{wasCorrect ? '✅' : '❌'}</span>
                  <span className="species-name">
                    {commonName || sciName || `#${taxonId}`}
                    {sciName && commonName && <em className="species-sci"> ({sciName})</em>}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}

        <div className="shared-results-actions">
          <button type="button" className="btn btn--primary" onClick={() => navigate('/')}>
            {t('collection_share.play_too', {}, 'Jouer aussi !')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SharedResultsPage;
