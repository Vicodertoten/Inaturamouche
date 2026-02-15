import React, { useState, useEffect } from 'react';
import CollectionService, { MASTERY_NAMES } from '../services/CollectionService';
import './SpeciesDetailModal.css';
import { useLanguage } from '../context/LanguageContext.jsx';
import { getTaxonDetails } from '../services/api';
import { toSafeHttpUrl } from '../utils/mediaUtils';

const MasteryBadge = ({ level }) => {
  if (level === 0) return null;
  return (
    <div className={`mastery-badge mastery-${level}`}>
      {MASTERY_NAMES[level]}
    </div>
  );
};

const fetchWikipediaSummary = async (scientificName, language = 'en') => {
  try {
    const lang = language || 'en';
    const url = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(scientificName)}`;
    const response = await fetch(url, { headers: { 'Accept': 'application/json' } });
    if (!response.ok) throw new Error('Wikipedia API request failed');
    const data = await response.json();
    return data.extract;
  } catch (error) {
    console.error("Failed to fetch from Wikipedia:", error);
    return null;
  }
};

export default function SpeciesDetailModal({ taxonId, onClose }) {
  const { t, formatDate, language } = useLanguage();
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('stats');
  const [description, setDescription] = useState(t('common.loading'));
  const [similarSpecies, setSimilarSpecies] = useState([]);
  const [loadingSimilar, setLoadingSimilar] = useState(false);

  // Load species detail on mount
  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      if (!taxonId) {
        setError('No taxon ID provided');
        setLoading(false);
        return;
      }
      try {
        const result = await CollectionService.getSpeciesDetail(taxonId);
        if (!isMounted) return;

        if (!result || !result.taxon) {
          setError('Species not found');
          setLoading(false);
          return;
        }

        let localizedTaxon = null;
        try {
          localizedTaxon = await getTaxonDetails(taxonId, language);
        } catch (err) {
          console.warn('Failed to fetch localized taxon details:', err);
        }

        const mergedTaxon = localizedTaxon || result.taxon;
        const mergedAncestors = localizedTaxon?.ancestors || result.ancestors || [];

        setDetail({ ...result, taxon: mergedTaxon, ancestors: mergedAncestors });
        setLoading(false);

        // Fetch similar species
        setLoadingSimilar(true);
        const similar = await CollectionService.getSimilarSpecies(taxonId, result.ancestors);
        if (isMounted) {
          setSimilarSpecies(similar);
          setLoadingSimilar(false);
        }

        // Prepare description
        if (mergedTaxon.description) {
          setDescription(mergedTaxon.description);
        } else {
          setDescription(t('common.loading'));
          const summary = await fetchWikipediaSummary(mergedTaxon.name, language);
          if (isMounted) {
            if (summary) {
              setDescription(summary);
              // Cache it
              CollectionService.updateTaxonDescription(taxonId, summary);
            } else {
              setDescription(t('species.no_description'));
            }
          }
        }
      } catch (err) {
        console.error('Failed to load species detail:', err);
        if (isMounted) {
          setError(err.message);
          setLoading(false);
        }
      }
    };
    void load();
    return () => {
      isMounted = false;
    };
  }, [taxonId, t, language]);

  if (loading) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          <button type="button" className="modal-close-button" onClick={onClose}>&times;</button>
          <div className="modal-body">
            <p>{t('common.loading')}</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          <button type="button" className="modal-close-button" onClick={onClose}>&times;</button>
          <div className="modal-body">
            <p className="error-message">{t('errors.title')}: {error || t('errors.generic')}</p>
          </div>
        </div>
      </div>
    );
  }

  const { taxon, stats } = detail;
  const masteryLevel = stats?.masteryLevel || 0;
  const seenCount = stats?.seenCount || 0;
  const correctCount = stats?.correctCount || 0;
  const accuracy = seenCount > 0 ? Math.round((correctCount / seenCount) * 100) : 0;
  const streak = stats?.streak || 0;
  const firstSeenAt = stats?.firstSeenAt ? formatDate(stats.firstSeenAt) : '—';
  const lastSeenAt = stats?.lastSeenAt ? formatDate(stats.lastSeenAt) : '—';
  const safeTaxonInaturalistUrl = toSafeHttpUrl(`https://www.inaturalist.org/taxa/${taxon.id}`);
  const safeTaxonWikipediaUrl = toSafeHttpUrl(
    taxon.wikipedia_url || `https://${language || 'en'}.wikipedia.org/wiki/${encodeURIComponent(taxon.name)}`
  );

  // Extract best image URL
  const headerImage =
    taxon.medium_url ||
    taxon.picture_url_medium ||
    taxon.small_url ||
    taxon.picture_url_small ||
    taxon.square_url ||
    taxon.thumbnail ||
    taxon.default_photo?.medium_url ||
    taxon.default_photo?.small_url ||
    taxon.default_photo?.square_url ||
    taxon.default_photo?.url ||
    '';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="modal-close-button" onClick={onClose}>&times;</button>

        <header className="modal-header">
          {headerImage && (
            <img src={headerImage} alt={taxon.name} className="modal-header-image" />
          )}
          <div className="modal-header-overlay">
            <div className="modal-title">
              <h1 className="common-name">
                {taxon.preferred_common_name || taxon.name}
              </h1>
              <p className="scientific-name">{taxon.name}</p>
            </div>
            <MasteryBadge level={masteryLevel} />
          </div>
        </header>

        <div className="modal-body">
          <div className="tabs">
            <button
              className={`tab-button ${activeTab === 'stats' ? 'active' : ''}`}
              onClick={() => setActiveTab('stats')}
            >
              {t('species.tabs.stats')}
            </button>
            <button
              className={`tab-button ${activeTab === 'encyclopedia' ? 'active' : ''}`}
              onClick={() => setActiveTab('encyclopedia')}
            >
              {t('species.tabs.encyclopedia')}
            </button>
            <button
              className={`tab-button ${activeTab === 'taxonomy' ? 'active' : ''}`}
              onClick={() => setActiveTab('taxonomy')}
            >
              {t('species.tabs.taxonomy')}
            </button>
          </div>

          {activeTab === 'stats' && stats && (
            <div className="tab-content">
              <div className="stat-grid">
                <div className="stat-item">
                  <div className="label">{t('species.stats.first_encounter')}</div>
                  <div className="value">{firstSeenAt}</div>
                </div>
                <div className="stat-item">
                  <div className="label">{t('species.stats.last_seen')}</div>
                  <div className="value">{lastSeenAt}</div>
                </div>
                <div className="stat-item">
                  <div className="label">{t('species.stats.times_seen')}</div>
                  <div className="value">{seenCount}</div>
                </div>
                <div className="stat-item">
                  <div className="label">{t('species.stats.correct_ids')}</div>
                  <div className="value">{correctCount}</div>
                </div>
                <div className="stat-item">
                  <div className="label">{t('species.stats.accuracy')}</div>
                  <div className="value">{accuracy}%</div>
                </div>
                <div className="stat-item">
                  <div className="label">{t('species.stats.current_streak')}</div>
                  <div className="value">{streak}</div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'encyclopedia' && (
            <div className="tab-content">
              <div className="encyclopedia-content">
                <p>{description}</p>
              </div>
              <div className="encyclopedia-links">
                {safeTaxonInaturalistUrl && (
                  <a
                    href={safeTaxonInaturalistUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {t('summary.links.inaturalist')}
                  </a>
                )}
                {safeTaxonWikipediaUrl && (
                  <a
                    href={safeTaxonWikipediaUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {t('summary.links.wikipedia')}
                  </a>
                )}
              </div>
            </div>
          )}

          {activeTab === 'taxonomy' && (
            <div className="tab-content">
              <div className="similar-species-content">
                {loadingSimilar ? (
                  <p className="loading-text">{t('species.similar.finding')}</p>
                ) : similarSpecies && similarSpecies.length > 0 ? (
                  <div className="similar-species-grid">
                    {similarSpecies.map((species) => {
                      const safeSimilarInatUrl = toSafeHttpUrl(`https://www.inaturalist.org/taxa/${species.id}`);
                      const speciesImage =
                        species.default_photo?.medium_url ||
                        species.default_photo?.square_url ||
                        species.medium_url ||
                        species.square_url ||
                        '';
                      return (
                        <div key={species.id} className="similar-species-card">
                          {speciesImage && (
                            <img
                              src={speciesImage}
                              alt={species.name}
                              className="similar-species-image"
                            />
                          )}
                          <div className="similar-species-info">
                            <p className="similar-common-name">
                              {species.preferred_common_name || species.name}
                            </p>
                            <p className="similar-scientific-name">{species.name}</p>
                          </div>
                          {safeSimilarInatUrl && (
                            <a
                              href={safeSimilarInatUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="similar-species-link"
                            >
                              {t('common.view')}
                            </a>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="no-similar-text">{t('species.similar.none')}</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
