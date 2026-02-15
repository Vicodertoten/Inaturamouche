import React, { useState, useCallback, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';

import CollectionService, { MASTERY_LEVELS } from '../services/CollectionService';
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
  47126: '🌿', // Plantae
  47158: '🦋', // Insecta
  3:     '🐦', // Aves
  47119: '🍄', // Fungi
  40151: '🦊', // Mammalia
  26036: '🦎', // Reptilia
  20978: '🐸', // Amphibia
  47178: '🐚', // Mollusca
  47686: '🕷️', // Arachnida
  1:     '🐾', // Animalia
};

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
        <h1>{t('collection.title')}</h1>
      </div>
      <div className="iconic-taxa-grid tutorial-collection-grid">
        {ICONIC_TAXA_LIST.map((iconicTaxon) => {
          const stats = summary?.[iconicTaxon.id] || {
            seenCount: 0,
            masteredCount: 0,
            progressPercent: 0,
            masteryBreakdown: {},
          };
          const icon = ICONIC_ICONS[iconicTaxon.id] || '🔬';

          return (
            <div
              key={iconicTaxon.id}
              className={`iconic-taxon-card ${stats.seenCount > 0 ? '' : 'iconic-empty'}`}
              role="button"
              tabIndex={0}
              onClick={() => onSelectIconic(iconicTaxon.id)}
              onKeyDown={(event) => handleCardKeyDown(event, iconicTaxon.id)}
            >
              <span className="iconic-icon" aria-hidden="true">{icon}</span>
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
  const { t } = useLanguage();
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
  }, [debouncedSearch, filterStatus, sortOrder, iconicTaxonId]);

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
        });
        if (isMounted) {
          setSpecies(result.species);
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
  }, [iconicTaxonId, sortOrder, debouncedSearch, filterStatus, page, collectionVersion]);

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
          <input
            type="search"
            className="collection-search"
            placeholder={t('collection.search_placeholder') || 'Rechercher...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label={t('collection.search_placeholder') || 'Search species'}
          />

          <select
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

          <select
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
