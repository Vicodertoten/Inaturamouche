import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';

import CollectionService, { MASTERY_LEVELS } from '../services/CollectionService';
import { ICONIC_TAXA_LIST } from '../utils/collectionUtils';
import CollectionCard from '../components/CollectionCard';
import SpeciesDetailModal from '../components/SpeciesDetailModal';
import { useUser } from '../context/UserContext';
import './CollectionPage.css';

const COLUMN_WIDTH = 180;

// ============== IconicTaxaGrid Component ==============

function IconicTaxaGrid({ onSelectIconic }) {
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
        <h1>Living Atlas</h1>
      </div>
      <div className="iconic-taxa-grid">
        {ICONIC_TAXA_LIST.map((iconicTaxon) => {
          const stats = summary?.[iconicTaxon.id] || {
            seenCount: 0,
            masteredCount: 0,
            progressPercent: 0,
            masteryBreakdown: {},
          };

          const progressPercent = stats.progressPercent || 0;

          return (
            <div
              key={iconicTaxon.id}
              className="iconic-taxon-card"
              onClick={() => onSelectIconic(iconicTaxon.id)}
            >
              <div className="iconic-card-header">
                <h2>{iconicTaxon.name}</h2>
              </div>
              <div className="iconic-card-body">
                <p className="iconic-stat">
                  {stats.seenCount} species seen
                </p>
                <p className="iconic-stat">
                  {stats.masteredCount} mastered
                </p>
              </div>
              <div className="iconic-card-progress">
                <div className="progress-bar-bg">
                  <div
                    className="progress-bar-fill"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <span className="progress-percent">{progressPercent}%</span>
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
  const [sortOrder, setSortOrder] = useState('mastery');
  const [species, setSpecies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const iconicTaxonName = ICONIC_TAXA_LIST.find(t => t.id === iconicTaxonId)?.name || 'Collection';

  // Fetch species data
  useEffect(() => {
    let isMounted = true;
    const fetch = async () => {
      try {
        setLoading(true);
        console.log(`🔍 Fetching species for iconic ${iconicTaxonId}...`);
        const result = await CollectionService.getSpeciesPage({
          iconicId: iconicTaxonId,
          offset: 0,
          limit: 500,
          sort: sortOrder,
        });
        console.log(`✅ Fetched ${result.species.length} species (total: ${result.total})`);
        if (isMounted) {
          setSpecies(result.species);
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
  }, [iconicTaxonId, sortOrder, collectionVersion]);

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
        <button onClick={onBack} className="back-button">&larr; Back</button>
        <p>Error: {error}</p>
      </div>
    );
  }

  return (
    <>
      <div className="collection-header">
        <button onClick={onBack} className="back-button">&larr; Back</button>
        <h1>{iconicTaxonName}</h1>
        <div className="sort-controls">
          <label htmlFor="sort-select">Sort:</label>
          <select
            id="sort-select"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
          >
            <option value="mastery">Mastery</option>
            <option value="recent">Recently Seen</option>
            <option value="alpha">Alphabetical</option>
          </select>
        </div>
      </div>

      {loading && !species.length ? (
        <div className="collection-loading">
          <p>Loading species...</p>
        </div>
      ) : species.length === 0 ? (
        <div className="collection-empty">
          <p>No species in this category yet.</p>
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
