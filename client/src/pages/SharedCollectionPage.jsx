import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { decodeCollectionSnapshot } from '../utils/collectionShare';
import { useLanguage } from '../context/LanguageContext.jsx';
import './SharedCollectionPage.css';

const MASTERY_EMOJI = ['🌱', '🌿', '🌳', '⭐', '💎'];

const SharedCollectionPage = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [snapshot, setSnapshot] = useState(null);
  const [error, setError] = useState(false);

  const decodeSnapshot = useCallback(() => {
    if (!token) {
      setError(true);
      setSnapshot(null);
      return;
    }
    const decoded = decodeCollectionSnapshot(token);
    if (!decoded) {
      setError(true);
      setSnapshot(null);
      return;
    }
    setError(false);
    setSnapshot(decoded);
  }, [token]);

  useEffect(() => {
    decodeSnapshot();
  }, [decodeSnapshot]);

  if (error) {
    return (
      <div className="screen shared-collection-screen">
        <div className="card">
          <h1>❌ {t('collection_share.invalid', {}, 'Collection introuvable')}</h1>
          <p>{t('collection_share.invalid_text', {}, 'Ce lien de collection n\'est pas valide.')}</p>
          <button type="button" className="btn btn--primary" onClick={() => navigate('/')}>
            {t('common.home', {}, 'Accueil')}
          </button>
        </div>
      </div>
    );
  }

  if (!snapshot) {
    return (
      <div className="screen shared-collection-screen">
        <div className="card shared-collection-card shared-status-card" role="status" aria-live="polite">
          <div className="shared-status-spinner" aria-hidden="true" />
          <h1 className="shared-status-title">
            {t('collection_share.loading_title', {}, 'Chargement de la collection…')}
          </h1>
          <p className="shared-status-text">
            {t('collection_share.loading_text', {}, 'Décodage du lien partagé.')}
          </p>
          <button type="button" className="btn btn--secondary" onClick={decodeSnapshot}>
            {t('common.retry', {}, 'Réessayer')}
          </button>
        </div>
      </div>
    );
  }

  const speciesCount = snapshot.s?.length || 0;

  return (
    <div className="screen shared-collection-screen">
      <div className="card shared-collection-card">
        <div className="shared-header">
          <h1 className="shared-name">{snapshot.n}</h1>
          <div className="shared-meta">
            <span className="shared-level">🏅 Niveau {snapshot.l}</span>
            <span className="shared-xp">⭐ {snapshot.x} XP</span>
            <span className="shared-games">🎮 {snapshot.g} parties</span>
          </div>
        </div>

        <h3 className="section-title">
          {t('collection_share.species_title', { count: speciesCount },
            `${speciesCount} espèces découvertes`
          )}
        </h3>

        {speciesCount > 0 ? (
          <ul className="shared-species-list">
            {snapshot.s.map(([id, correct, encounters]) => {
              const masteryIdx = Math.min(Math.floor(correct / 3), MASTERY_EMOJI.length - 1);
              return (
                <li key={id} className="shared-species-item">
                  <span className="shared-species-mastery">{MASTERY_EMOJI[masteryIdx]}</span>
                  <span className="shared-species-id">#{id}</span>
                  <span className="shared-species-stats">
                    {correct}✅ / {encounters} rencontres
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="shared-empty">{t('collection_share.empty', {}, 'Aucune espèce pour le moment.')}</p>
        )}

        <div className="shared-actions">
          <button type="button" className="btn btn--primary" onClick={() => navigate('/')}>
            {t('collection_share.play_too', {}, 'Jouer aussi !')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SharedCollectionPage;
