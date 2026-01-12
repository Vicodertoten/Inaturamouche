import React, { useCallback, useEffect, useState } from 'react';
import { fetchSimilarSpecies } from '../services/api';
import { taxonGroupsTable } from '../services/db';
import { normalizeAncestorIds, resolveImageUrls } from '../utils/speciesUtils';
import './SpeciesDetailModal.css';

const TABS = {
  STATS: 'stats',
  BIOLOGY: 'biologie',
  CONFUSIONS: 'confusions',
};

const TAB_LABELS = {
  [TABS.STATS]: 'Stats',
  [TABS.BIOLOGY]: 'Biologie',
  [TABS.CONFUSIONS]: 'Confusions',
};

const formatLastSeen = (value) => {
  if (!value) return 'Jamais vu';
  const date = new Date(value);
  return date.toLocaleDateString('fr-FR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

const getDisplayName = (taxon) =>
  taxon?.preferred_common_name ||
  taxon?.common_name ||
  taxon?.name ||
  'Espèce inconnue';

const parseSimilarityScore = (entry) => {
  const fallback = entry?.similarity ?? entry?.confidence ?? entry?.score ?? entry?.match_score;
  if (typeof fallback === 'number') {
    if (fallback <= 1) return `${Math.round(fallback * 100)}%`;
    return `${Math.round(fallback)}`;
  }
  return fallback ?? '—';
};

const buildSimilarCandidate = (entry) => {
  const taxon = entry?.taxon || entry;
  const { square_url, small_url } = resolveImageUrls(taxon);
  return {
    id: taxon?.id,
    name: taxon?.name,
    common: taxon?.preferred_common_name ?? taxon?.common_name,
    image: square_url || small_url || taxon?.thumbnail || null,
    rank: taxon?.rank,
    similarity: parseSimilarityScore(entry),
  };
};

const SpeciesDetailModal = ({ species, onClose }) => {
  const [activeTab, setActiveTab] = useState(TABS.STATS);
  const [ancestors, setAncestors] = useState([]);
  const [similarSpecies, setSimilarSpecies] = useState([]);
  const [similarState, setSimilarState] = useState('idle');
  const [similarError, setSimilarError] = useState('');

  useEffect(() => {
    setActiveTab(TABS.STATS);
    setAncestors([]);
    setSimilarState('idle');
    setSimilarSpecies([]);
    setSimilarError('');
  }, [species?.id]);

  useEffect(() => {
    let cancelled = false;
    const loadAncestors = async () => {
      if (!species) return;
      const ancestorIds = normalizeAncestorIds(species);
      if (!ancestorIds.length) {
        setAncestors([]);
        return;
      }
      try {
        const records = await taxonGroupsTable.bulkGet(ancestorIds);
        if (cancelled) return;
        const formatted = ancestorIds
          .map((id, index) => ({
            id,
            name: records[index]?.name,
            rank: records[index]?.rank,
          }))
          .filter((item) => item.name);
        setAncestors(formatted);
      } catch (error) {
        console.error('SpeciesDetailModal: failed to load ancestors', error);
      }
    };
    loadAncestors();
    return () => {
      cancelled = true;
    };
  }, [species]);

  const loadSimilar = useCallback(async () => {
    if (!species?.id) return;
    setSimilarState('loading');
    setSimilarError('');
    try {
      const payload = await fetchSimilarSpecies(species.id);
      setSimilarSpecies(
        Array.isArray(payload) ? payload.map(buildSimilarCandidate) : []
      );
      setSimilarState('ready');
    } catch (error) {
      setSimilarError(error.message || 'Les espèces similaires sont indisponibles.');
      setSimilarState('error');
    }
  }, [species?.id]);

  useEffect(() => {
    if (activeTab !== TABS.CONFUSIONS) return;
    if (similarState === 'idle') {
      void loadSimilar();
    }
  }, [activeTab, similarState, loadSimilar]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const handleBackdropClick = (event) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  if (!species) return null;

  const { square_url, medium_url } = resolveImageUrls(species);
  const displayName = getDisplayName(species);
  const statsRows = [
    { label: 'Vus', value: species.seenCount ?? 0 },
    { label: 'Corrects', value: species.correctCount ?? 0 },
    {
      label: 'Précision',
      value:
        species.accuracy !== undefined
          ? `${Math.round((species.accuracy ?? 0) * 100)}%`
          : '—',
    },
    { label: 'Dernier aperçu', value: formatLastSeen(species.lastSeenAt) },
  ];
  const displayedSimilar = similarSpecies.slice(0, 6);

  return (
    <div className="species-modal-backdrop" onMouseDown={handleBackdropClick}>
      <div
        className="species-modal-content"
        role="dialog"
        aria-modal="true"
        aria-label={`Fiche de ${displayName}`}
      >
        <header className="species-modal-header">
          <div className="species-modal-media">
            <img
              src={medium_url || square_url || species.thumbnail}
              alt={displayName}
              loading="lazy"
            />
          </div>
          <div className="species-modal-titles">
            <p className="species-modal-eyebrow">{species.rank || 'Taxon'}</p>
            <h2 className="species-modal-name">{displayName}</h2>
            {species.name && (
              <p className="species-modal-scientific">
                <em>{species.name}</em>
              </p>
            )}
          </div>
          <button
            type="button"
            className="species-modal-close"
            onClick={onClose}
            aria-label="Fermer la fiche"
          >
            &times;
          </button>
        </header>

        <div className="species-modal-tabs">
          {Object.entries(TAB_LABELS).map(([tabKey, label]) => (
            <button
              key={tabKey}
              type="button"
              className={`species-modal-tab ${activeTab === tabKey ? 'active' : ''}`}
              onClick={() => setActiveTab(tabKey)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="species-modal-body">
          {activeTab === TABS.STATS && (
            <div className="species-stats-grid">
              {statsRows.map((row) => (
                <div className="species-stats-card" key={row.label}>
                  <span className="species-stats-label">{row.label}</span>
                  <span className="species-stats-value">{row.value}</span>
                </div>
              ))}
            </div>
          )}

          {activeTab === TABS.BIOLOGY && (
            <div className="species-bio-grid">
              <div className="species-bio-row">
                <span>Rang</span>
                <strong>{species.rank || '—'}</strong>
              </div>
              <div className="species-bio-row">
                <span>Icône</span>
                <strong>{species.iconic_taxon_id || 'N/A'}</strong>
              </div>
              <div className="species-bio-row species-bio-ancestors">
                <span>Ancêtres</span>
                <ul>
                  {ancestors.length > 0 ? (
                    ancestors.map((ancestor) => (
                      <li key={ancestor.id}>
                        <strong>{ancestor.rank || 'Taxon'}</strong>: {ancestor.name}
                      </li>
                    ))
                  ) : (
                    <li>En cours de récupération…</li>
                  )}
                </ul>
              </div>
            </div>
          )}

          {activeTab === TABS.CONFUSIONS && (
            <section className="species-confusions">
              <div className="confusions-column">
                <p className="confusions-label">Cette espèce</p>
                <div className="confusions-card">
                  <p className="species-name">{displayName}</p>
                  <p className="species-modal-scientific">
                    <em>{species.name}</em>
                  </p>
                  <p className="species-stats">
                    Vus: {species.seenCount ?? 0} · Précision:{' '}
                    {species.accuracy ? `${Math.round(species.accuracy * 100)}%` : '—'}
                  </p>
                </div>
              </div>
              <div className="confusions-column">
                <p className="confusions-label">Espèces similaires</p>
                {similarState === 'loading' && <p>Chargement des confusions…</p>}
                {similarState === 'error' && (
                  <p className="species-error">{similarError}</p>
                )}
                {similarState === 'ready' && similarSpecies.length === 0 && (
                  <p>Aucune confusion connue pour cette espèce.</p>
                )}
                {similarState === 'ready' && similarSpecies.length > 0 && (
                  <div className="similar-species-list">
                    {displayedSimilar.map((candidate) => (
                      <article key={`${candidate.id}-${candidate.similarity}`} className="similar-species-card">
                        {candidate.image && (
                          <div
                            className="similar-species-image"
                            style={{ backgroundImage: `url(${candidate.image})` }}
                            aria-hidden="true"
                          />
                        )}
                        <div>
                          <p className="species-name">{candidate.common || candidate.name}</p>
                          <p className="species-modal-scientific">
                            <em>{candidate.name}</em>
                          </p>
                          <p className="species-stats">
                            <span>Rang: {candidate.rank || '—'}</span> ·{' '}
                            <span>Similarité: {candidate.similarity}</span>
                          </p>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
};

export default SpeciesDetailModal;
