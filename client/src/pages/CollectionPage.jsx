import React, { useState, useCallback, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';

import CollectionService, { MASTERY_LEVELS } from '../services/CollectionService';
import { getTaxaByIds } from '../services/api';
import { ICONIC_TAXA, ICONIC_TAXA_LIST } from '../utils/collectionUtils';
import CollectionCard from '../components/CollectionCard';
import SpeciesDetailModal from '../components/SpeciesDetailModal';
import { useUser } from '../context/UserContext';
import { useLanguage } from '../context/LanguageContext.jsx';
import './CollectionPage.css';

const getIconicLabel = (iconicTaxonId, t) => {
  const entry = Object.entries(ICONIC_TAXA).find(([, value]) => value.id === iconicTaxonId);
  if (!entry) return t('collection.title');
  const [key, value] = entry;
  return t(`collection.iconic_taxa.${key}`, {}, value.name);
};

const ICONIC_ICONS = {
  47126: function PlantaeIcon() {
    return (
      <>
        <path d="M12 21V10" />
        <path d="M12 10C8 10 5 7 5 3c4 0 7 3 7 7Z" />
        <path d="M12 10c4 0 7-3 7-7-4 0-7 3-7 7Z" />
      </>
    );
  },
  47158: function InsectaIcon() {
    return (
      <>
        <path d="M12 6v12" />
        <path d="M12 8c-2.4-3.5-7-4.2-8-1.3-.6 1.7.4 3.6 2.3 4.2L12 12" />
        <path d="M12 8c2.4-3.5 7-4.2 8-1.3.6 1.7-.4 3.6-2.3 4.2L12 12" />
        <path d="M12 12l-4 6" />
        <path d="M12 12l4 6" />
      </>
    );
  },
  3: function AvesIcon() {
    return (
      <>
        <path d="M6 14c0-4.4 3.6-8 8-8 2.4 0 4.5 1 6 2.7-1.2 4.8-4.8 8.3-9.2 8.3-2.6 0-4.8-1.2-4.8-3Z" />
        <path d="M20 9l-4 1" />
        <circle cx="14" cy="10" r="1" fill="currentColor" stroke="none" />
      </>
    );
  },
  47119: function FungiIcon() {
    return (
      <>
        <path d="M4 12c0-4 3.6-7 8-7s8 3 8 7" />
        <path d="M6 12h12" />
        <path d="M10 12v6" />
        <path d="M14 12v6" />
        <path d="M8 21h8" />
      </>
    );
  },
  40151: function MammaliaIcon() {
    return (
      <>
        <path d="M7 8 4 4v6" />
        <path d="M17 8 20 4v6" />
        <path d="M12 20c-4.5 0-8-3.2-8-7.2C4 8.5 7.6 6 12 6s8 2.5 8 6.8C20 16.8 16.5 20 12 20Z" />
        <circle cx="9" cy="12" r="1" fill="currentColor" stroke="none" />
        <circle cx="15" cy="12" r="1" fill="currentColor" stroke="none" />
        <path d="M12 14.5 10.5 16h3L12 14.5Z" fill="currentColor" stroke="none" />
      </>
    );
  },
  26036: function ReptiliaIcon() {
    return (
      <>
        <path d="M5 13c1.6-2 3.6-3 6-3 3.5 0 6 2 8 5" />
        <path d="M9 10 8 7" />
        <path d="M13 10l1-3" />
        <path d="M8 13l-3 2" />
        <path d="M16 14l3 2" />
        <path d="M19 15c.8.7 1.6 1.7 2 3" />
        <path d="M4 16c-1 0-2-.8-2-2s1-2 2-2" />
      </>
    );
  },
  20978: function AmphibiaIcon() {
    return (
      <>
        <circle cx="8" cy="8" r="2" />
        <circle cx="16" cy="8" r="2" />
        <circle cx="8" cy="8" r="0.7" fill="currentColor" stroke="none" />
        <circle cx="16" cy="8" r="0.7" fill="currentColor" stroke="none" />
        <path d="M6 12c0-1.7 1.3-3 3-3h6c1.7 0 3 1.3 3 3v3c0 2.2-1.8 4-4 4h-4c-2.2 0-4-1.8-4-4Z" />
      </>
    );
  },
  47178: function MolluscaIcon() {
    return (
      <>
        <path d="M4 16c1.3 0 2.2-1 3.8-1 1.6 0 2.8 1 4.3 1h2.8a4.2 4.2 0 1 0 0-8.4 4.2 4.2 0 0 0-4.2 4.2 2.2 2.2 0 1 0 4.4 0" />
        <path d="M7 15 6 12" />
        <path d="M8.5 15 9.8 12.5" />
      </>
    );
  },
  47686: function ArachnidaIcon() {
    return (
      <>
        <circle cx="12" cy="9" r="2.2" />
        <circle cx="12" cy="14" r="3.2" />
        <path d="M9.5 9.5 5 6" />
        <path d="M8.6 11.6 4 11" />
        <path d="M8.8 14.8 4.5 17.5" />
        <path d="M14.5 9.5 19 6" />
        <path d="M15.4 11.6 20 11" />
        <path d="M15.2 14.8 19.5 17.5" />
      </>
    );
  },
  1: function AnimaliaIcon() {
    return (
      <>
        <circle cx="7" cy="8" r="1.7" />
        <circle cx="11" cy="6.6" r="1.7" />
        <circle cx="15" cy="6.6" r="1.7" />
        <circle cx="17.8" cy="9.2" r="1.5" />
        <path d="M12 20c-2.5 0-5-1.5-5-4 0-1.8 1.4-3.3 3.1-3.3 1 0 1.8.5 2.4 1.3.6-.8 1.4-1.3 2.4-1.3 1.7 0 3.1 1.5 3.1 3.3 0 2.5-2.5 4-5 4Z" />
      </>
    );
  },
  default: function DefaultIcon() {
    return (
      <>
        <circle cx="10" cy="10" r="3.5" />
        <path d="M12.5 12.5 16 16" />
        <path d="M16 6.5V3.5" />
        <path d="M14.5 5h3" />
        <path d="M5 20h14" />
        <path d="M12 16v4" />
      </>
    );
  },
};

function IconicTaxonIcon({ iconicTaxonId }) {
  const Glyph = ICONIC_ICONS[iconicTaxonId] || ICONIC_ICONS.default;

  return (
    <svg
      className="iconic-icon-svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <Glyph />
    </svg>
  );
}

// ============== IconicTaxaGrid Component ==============

function IconicTaxaGrid({ onSelectIconic }) {
  const { t } = useLanguage();
  const handleCardKeyDown = (event, taxonId) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelectIconic(taxonId);
    }
  };
  // Fetch iconic summary via CollectionService (no toArray)
  const summary = useLiveQuery(
    async () => {
      try {
        return await CollectionService.getIconicSummary();
      } catch (error) {
        console.error('Failed to fetch iconic summary:', error);
        return {};
      }
    },
    [],
    {}
  );

  return (
    <>
      <div className="collection-header">
        <h2>{t('collection.title')}</h2>
      </div>
      <div className="iconic-taxa-grid tutorial-collection-grid">
        {ICONIC_TAXA_LIST.map((iconicTaxon) => {
          const stats = summary?.[iconicTaxon.id] || {
            seenCount: 0,
            masteredCount: 0,
            progressPercent: 0,
            masteryBreakdown: {},
          };
          return (
            <div
              key={iconicTaxon.id}
              className={`iconic-taxon-card ${stats.seenCount > 0 ? '' : 'iconic-empty'}`}
              role="button"
              tabIndex={0}
              onClick={() => onSelectIconic(iconicTaxon.id)}
              onKeyDown={(event) => handleCardKeyDown(event, iconicTaxon.id)}
            >
              <span className="iconic-icon" aria-hidden="true">
                <IconicTaxonIcon iconicTaxonId={iconicTaxon.id} />
              </span>
              <h2>{getIconicLabel(iconicTaxon.id, t)}</h2>
              <p className="iconic-stat">
                {stats.seenCount} {t('collection.species_discovered', {}, 'découvertes')}
              </p>
              {stats.seenCount > 0 && stats.masteredCount > 0 && (
                <div className="iconic-mastery-dots">
                  {(stats.masteryBreakdown?.[MASTERY_LEVELS.DIAMOND] || 0) > 0 && (
                    <span className="mastery-dot mastery-dot-diamond" title={t('collection.mastery_diamond', {}, 'Diamant')}>💎 {stats.masteryBreakdown[MASTERY_LEVELS.DIAMOND]}</span>
                  )}
                  {(stats.masteryBreakdown?.[MASTERY_LEVELS.GOLD] || 0) > 0 && (
                    <span className="mastery-dot mastery-dot-gold" title={t('collection.mastery_gold', {}, 'Or')}>🥇 {stats.masteryBreakdown[MASTERY_LEVELS.GOLD]}</span>
                  )}
                  {(stats.masteryBreakdown?.[MASTERY_LEVELS.SILVER] || 0) > 0 && (
                    <span className="mastery-dot mastery-dot-silver" title={t('collection.mastery_silver', {}, 'Argent')}>🥈 {stats.masteryBreakdown[MASTERY_LEVELS.SILVER]}</span>
                  )}
                  {(stats.masteryBreakdown?.[MASTERY_LEVELS.BRONZE] || 0) > 0 && (
                    <span className="mastery-dot mastery-dot-bronze" title={t('collection.mastery_bronze', {}, 'Bronze')}>🥉 {stats.masteryBreakdown[MASTERY_LEVELS.BRONZE]}</span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

// ============== SpeciesGrid Component ==============

function SpeciesGrid({ iconicTaxonId, onBack, onSpeciesSelect }) {
  const { collectionVersion } = useUser();
  const { t, language } = useLanguage();
  const [sortOrder, setSortOrder] = useState('mastery');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  // Debounce search input — 300ms delay before triggering fetch
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const [species, setSpecies] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const iconicTaxonName = getIconicLabel(iconicTaxonId, t);
  const handleSpeciesKeyDown = (event, item) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSpeciesSelect(item);
    }
  };

  // Reset page when search, filter or sort changes
  useEffect(() => {
    setPage(0);
  }, [debouncedSearch, filterStatus, sortOrder, iconicTaxonId, language]);

  // Fetch species data
  useEffect(() => {
    let isMounted = true;
    const fetch = async () => {
      try {
        setLoading(true);
        console.log(`🔍 Fetching species for iconic ${iconicTaxonId} (page ${page})...`);
        const result = await CollectionService.getSpeciesPage({
          iconicId: iconicTaxonId,
          offset: page * PAGE_SIZE,
          limit: PAGE_SIZE,
          sort: sortOrder,
          searchQuery: debouncedSearch,
          filterStatus,
          language,
        });

        if (!isMounted) return;

        // Enrich species with localized taxon data
        const enrichedSpecies = [...result.species];
        if (enrichedSpecies.length > 0 && language && language !== 'fr') {
          try {
            const taxonIds = enrichedSpecies.map((spec) => spec.taxon.id);
            const localizedTaxa = await getTaxaByIds(taxonIds, language);
            
            if (isMounted && localizedTaxa && localizedTaxa.length > 0) {
              // Map localized data back to species
              const localizedMap = new Map(localizedTaxa.map((t) => [t.id, t]));
              for (let i = 0; i < enrichedSpecies.length; i++) {
                const localized = localizedMap.get(enrichedSpecies[i].taxon.id);
                if (localized) {
                  enrichedSpecies[i].taxon.local_preferred_common_name = 
                    localized.preferred_common_name || localized.name;
                }
              }
            }
          } catch (err) {
            console.warn('Failed to fetch localized taxon data:', err);
            // Continue with non-localized data
          }
        }

        if (isMounted) {
          setSpecies(enrichedSpecies);
          setTotal(result.total || 0);
          setError(null);
        }
      } catch (err) {
        console.error('❌ Failed to fetch species page:', err);
        if (isMounted) setError(err.message);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    void fetch();
    return () => {
      isMounted = false;
    };
  }, [iconicTaxonId, sortOrder, debouncedSearch, filterStatus, page, collectionVersion, language]);

  // Listen for collection updates
  useEffect(() => {
    const unsubscribe = CollectionService.onCollectionUpdated(() => {
      const fetch = async () => {
        try {
          const result = await CollectionService.getSpeciesPage({
            iconicId: iconicTaxonId,
            offset: page * PAGE_SIZE,
            limit: PAGE_SIZE,
            sort: sortOrder,
            searchQuery: debouncedSearch,
            filterStatus,
          });
          setSpecies(result.species);
          setTotal(result.total || 0);
        } catch (err) {
          console.error('Failed to refresh:', err);
        }
      };
      void fetch();
    });
    return unsubscribe;
  }, [iconicTaxonId, sortOrder, debouncedSearch, filterStatus, page]);

  const retryFetch = useCallback(() => {
    setError(null);
    setLoading(true);
    CollectionService.getSpeciesPage({
      iconicId: iconicTaxonId,
      offset: page * PAGE_SIZE,
      limit: PAGE_SIZE,
      sort: sortOrder,
      searchQuery: debouncedSearch,
      filterStatus,
    }).then((result) => {
      setSpecies(result.species);
      setTotal(result.total || 0);
      setLoading(false);
    }).catch((err) => {
      setError(err.message);
      setLoading(false);
    });
  }, [iconicTaxonId, page, sortOrder, debouncedSearch, filterStatus]);

  if (error) {
    return (
      <div className="collection-error">
        <button onClick={onBack} className="back-button">{t('common.back')}</button>
        <p>{t('errors.title')}: {error}</p>
        <button onClick={retryFetch} className="btn btn--primary">
          {t('common.retry', {}, 'Réessayer')}
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="collection-header">
        <button onClick={onBack} className="back-button">← {iconicTaxonName}</button>

        <div className="collection-controls">
          <label className="sr-only" htmlFor="collection-search-input">
            {t('collection.search_label', {}, 'Rechercher une espèce')}
          </label>
          <input
            id="collection-search-input"
            type="search"
            className="collection-search"
            placeholder={t('collection.search_placeholder') || 'Rechercher...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label={t('collection.search_placeholder') || 'Search species'}
          />

          <label className="sr-only" htmlFor="collection-filter-select">
            {t('collection.filter_label') || 'Filtre'}
          </label>
          <select
            id="collection-filter-select"
            className="collection-select"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            aria-label={t('collection.filter_label') || 'Filtre'}
          >
            <option value="all">{t('collection.filter.all') || 'Tout'}</option>
            <option value="seen">{t('collection.filter.seen') || 'Découverts'}</option>
            <option value="mastered">{t('collection.filter.mastered') || 'Maîtrisés'}</option>
            <option value="to_learn">{t('collection.filter.to_learn') || "À apprendre"}</option>
          </select>

          <label className="sr-only" htmlFor="collection-sort-select">
            {t('collection.sort_label') || 'Tri'}
          </label>
          <select
            id="collection-sort-select"
            className="collection-select"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            aria-label={t('collection.sort_label')}
          >
            <option value="mastery">{t('collection.sort.mastery')}</option>
            <option value="recent">{t('collection.sort.recent')}</option>
            <option value="alpha">{t('collection.sort.alpha')}</option>
            <option value="rarity">{t('collection.sort.rarity')}</option>
          </select>
        </div>
      </div>

      <div className="species-section">
        {loading && !species.length ? (
          <div className="collection-loading">
            <p>{t('collection.loading_species')}</p>
          </div>
        ) : species.length === 0 ? (
          <div className="collection-empty">
            <p>{t('collection.empty')}</p>
          </div>
        ) : (
          <div className="species-grid-container">
            <div className="simple-grid">
              {species.map((item) => (
                <div
                  key={item.taxon.id}
                  className="species-grid-item"
                  role="button"
                  tabIndex={0}
                  onClick={() => onSpeciesSelect(item)}
                  onKeyDown={(event) => handleSpeciesKeyDown(event, item)}
                >
                  <CollectionCard taxon={item.taxon} collection={item.stats} />
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="pagination-controls">
          <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}>
            {t('common.prev') || 'Prev'}
          </button>
          <span className="page-info">{`${t('collection.page_prefix') || 'Page'} ${page + 1} / ${totalPages}`}</span>
          <button
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={page + 1 >= totalPages}
          >
            {t('common.next') || 'Next'}
          </button>
        </div>
      </div>
    </>
  );
}

// ============== Main CollectionPage Component ==============

export default function CollectionPage() {
  const [selectedIconicTaxonId, setSelectedIconicTaxonId] = useState(null);
  const [modalSpecies, setModalSpecies] = useState(null);
  const { t } = useLanguage();

  const handleSelectIconicTaxon = useCallback((taxonId) => {
    setSelectedIconicTaxonId(taxonId);
  }, []);

  const handleBack = useCallback(() => {
    setSelectedIconicTaxonId(null);
  }, []);

  const handleCloseModal = useCallback(() => {
    setModalSpecies(null);
  }, []);

  return (
    <div className="collection-page">
      <h1 className="sr-only">{t('collection.title')}</h1>
      {selectedIconicTaxonId ? (
        <SpeciesGrid
          iconicTaxonId={selectedIconicTaxonId}
          onBack={handleBack}
          onSpeciesSelect={setModalSpecies}
        />
      ) : (
        <IconicTaxaGrid onSelectIconic={handleSelectIconicTaxon} />
      )}
      {modalSpecies && (
        <SpeciesDetailModal
          taxonId={modalSpecies.taxon.id}
          onClose={handleCloseModal}
        />
      )}
    </div>
  );
}
