import React, { useState, useCallback, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';

import CollectionService, { MASTERY_LEVELS } from '../services/CollectionService';
import { ICONIC_TAXA, ICONIC_TAXA_LIST } from '../utils/collectionUtils';
import CollectionCard from '../components/CollectionCard';
import SpeciesDetailModal from '../components/SpeciesDetailModal';
import { useUser } from '../context/UserContext';
import { useLanguage } from '../context/LanguageContext.jsx';
import './CollectionPage.css';

const COLUMN_WIDTH = 180;

const getIconicLabel = (iconicTaxonId, t) => {
  const entry = Object.entries(ICONIC_TAXA).find(([, value]) => value.id === iconicTaxonId);
  if (!entry) return t('collection.title');
  const [key, value] = entry;
  return t(`collection.iconic_taxa.${key}`, {}, value.name);
};

// ============== IconicTaxaGrid Component ==============

function IconicTaxaGrid({ onSelectIconic }) {
  const { t } = useLanguage();
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
      <div className="iconic-taxa-grid">
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
              className="iconic-taxon-card"
              onClick={() => onSelectIconic(iconicTaxon.id)}
            >
              <div className="iconic-card-header">
                <h2>{getIconicLabel(iconicTaxon.id, t)}</h2>
              </div>
              <div className="iconic-card-body">
                <p className="iconic-stat">
                  {t('collection.species_seen', { count: stats.seenCount })}
                </p>
                <p className="iconic-stat">
                  {t('collection.mastered_count', { count: stats.masteredCount })}
                </p>
              </div>
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
  const [filterStatus, setFilterStatus] = useState('all');
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  const [species, setSpecies] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const iconicTaxonName = getIconicLabel(iconicTaxonId, t);

  // Reset page when search, filter or sort changes
  useEffect(() => {
    setPage(0);
  }, [searchQuery, filterStatus, sortOrder, iconicTaxonId]);

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
          searchQuery: searchQuery.trim(),
          filterStatus,
        });
        console.log(`✅ Fetched ${result.species.length} species (total: ${result.total})`);
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
  }, [iconicTaxonId, sortOrder, searchQuery, filterStatus, page, collectionVersion]);

  // Listen for collection updates
  useEffect(() => {
    const unsubscribe = CollectionService.onCollectionUpdated(() => {
      const fetch = async () => {
        try {
          const result = await CollectionService.getSpeciesPage({
            iconicId: iconicTaxonId,
            offset: 0,
            limit: 500,
            sort: sortOrder,
          });
          setSpecies(result.species);
        } catch (err) {
          console.error('Failed to refresh:', err);
        }
      };
      void fetch();
    });
    return unsubscribe;
  }, [iconicTaxonId, sortOrder]);

  if (error) {
    return (
      <div className="collection-error">
        <button onClick={onBack} className="back-button">{t('common.back')}</button>
        <p>{t('errors.title')}: {error}</p>
      </div>
    );
  }

  return (
    <>
      <div className="collection-header">
        <button onClick={onBack} className="back-button">{t('common.back')}</button>
        <h1>{iconicTaxonName}</h1>

        <div className="collection-controls">
          <div className="search-control">
            <input
              type="search"
              placeholder={t('collection.search_placeholder') || 'Rechercher...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label={t('collection.search_placeholder') || 'Search species'}
            />
          </div>

          <div className="filter-control">
            <label htmlFor="filter-select">{t('collection.filter_label') || 'Filtre'}</label>
            <select
              id="filter-select"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="all">{t('collection.filter.all') || 'Tout'}</option>
              <option value="seen">{t('collection.filter.seen') || 'Découverts'}</option>
              <option value="mastered">{t('collection.filter.mastered') || 'Maîtrisés'}</option>
              <option value="to_learn">{t('collection.filter.to_learn') || "À apprendre"}</option>
            </select>
          </div>

          <div className="sort-controls">
            <label htmlFor="sort-select">{t('collection.sort_label')}</label>
            <select
              id="sort-select"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
            >
              <option value="mastery">{t('collection.sort.mastery')}</option>
              <option value="recent">{t('collection.sort.recent')}</option>
              <option value="alpha">{t('collection.sort.alpha')}</option>
            </select>
          </div>
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
                  onClick={() => onSpeciesSelect(item)}
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
