import React, { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext.jsx';
import { decodePackSnapshot, snapshotToFilters } from '../utils/packShare';
import { savePack, getSavedPacks } from '../utils/savedPacks';
import './ImportPackPage.css';

const ImportPackPage = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [imported, setImported] = useState(false);

  const snapshot = useMemo(() => decodePackSnapshot(token || ''), [token]);
  const filters = useMemo(() => (snapshot ? snapshotToFilters(snapshot) : null), [snapshot]);

  if (!snapshot || !filters) {
    return (
      <div className="import-error-page">
        <h1>❌ {t('pack_share.invalid', {}, 'Pack introuvable')}</h1>
        <p>{t('pack_share.invalid_text', {}, 'Ce lien de pack n\'est pas valide.')}</p>
        <button className="btn btn--primary" onClick={() => navigate('/')}>
          {t('common.home', {}, 'Accueil')}
        </button>
      </div>
    );
  }

  const packName = snapshot.n || 'Pack partagé';

  const handleImport = () => {
    const existing = getSavedPacks();
    const duplicate = existing.find(
      (p) => (p.name || '').trim().toLowerCase() === packName.trim().toLowerCase()
    );
    if (duplicate) {
      // Already imported — just mark as success
      setImported(true);
      return;
    }
    savePack(packName, filters);
    setImported(true);
  };

  return (
    <div className="import-pack-page">
      <h1>📦 {t('pack_share.import_title', {}, 'Importer un pack')}</h1>

      <div className="import-pack-card">
        <h2>{packName}</h2>

        <div className="import-filter-summary">
          {filters.taxa_enabled && filters.includedTaxa?.length > 0 && (
            <div className="import-filter-item">
              <span className="import-filter-icon">🔬</span>
              <div>
                <span className="import-filter-label">
                  {t('pack_share.taxa_include', {}, 'Taxons inclus :')}
                </span>
                <div className="import-filter-tags">
                  {filters.includedTaxa.map((tx) => (
                    <span key={tx.id} className="import-filter-tag">{tx.name}</span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {filters.taxa_enabled && filters.excludedTaxa?.length > 0 && (
            <div className="import-filter-item">
              <span className="import-filter-icon">🚫</span>
              <div>
                <span className="import-filter-label">
                  {t('pack_share.taxa_exclude', {}, 'Taxons exclus :')}
                </span>
                <div className="import-filter-tags">
                  {filters.excludedTaxa.map((tx) => (
                    <span key={tx.id} className="import-filter-tag">{tx.name}</span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {filters.place_enabled && (
            <div className="import-filter-item">
              <span className="import-filter-icon">📍</span>
              <span>
                <span className="import-filter-label">
                  {t('pack_share.place', {}, 'Lieu :')}
                </span>
                {filters.geo?.place_name || filters.geo?.place_id || t('pack_share.map_area', {}, 'Zone carte')}
              </span>
            </div>
          )}

          {filters.period_enabled && (filters.d1 || filters.d2) && (
            <div className="import-filter-item">
              <span className="import-filter-icon">📅</span>
              <span>
                <span className="import-filter-label">
                  {t('pack_share.period', {}, 'Période :')}
                </span>
                {[filters.d1, filters.d2].filter(Boolean).join(' → ')}
              </span>
            </div>
          )}

          {!filters.taxa_enabled && !filters.place_enabled && !filters.period_enabled && (
            <p style={{ fontStyle: 'italic', color: 'var(--text-color-muted)' }}>
              {t('pack_share.no_filters', {}, 'Aucun filtre particulier')}
            </p>
          )}
        </div>
      </div>

      {imported && (
        <p className="import-success">
          ✅ {t('pack_share.imported', {}, 'Pack importé avec succès !')}
        </p>
      )}

      <div className="import-actions">
        {!imported ? (
          <button className="btn btn--primary" onClick={handleImport}>
            📥 {t('pack_share.import_btn', {}, 'Importer ce pack')}
          </button>
        ) : (
          <button className="btn btn--primary" onClick={() => navigate('/')}>
            🎮 {t('pack_share.play_now', {}, 'Jouer maintenant')}
          </button>
        )}
        <button className="btn btn--secondary" onClick={() => navigate('/')}>
          {t('common.home', {}, 'Accueil')}
        </button>
      </div>
    </div>
  );
};

export default ImportPackPage;
