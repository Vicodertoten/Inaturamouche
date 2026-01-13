import React, { useState, useEffect } from 'react';
import CollectionService, { MASTERY_NAMES } from '../services/CollectionService';
import './SpeciesDetailModal.css';


const MasteryBadge = ({ level }) => {
    if (level === 0) return null;
    return (
        <div className={`mastery-badge mastery-${level}`}>
            {MASTERY_NAMES[level]}
        </div>
    );
};

const fetchWikipediaSummary = async (scientificName) => {
    try {
        const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(scientificName)}`;
        const response = await fetch(url, { headers: { 'Accept': 'application/json' } });
        if (!response.ok) throw new Error('Wikipedia API request failed');
        const data = await response.json();
        return data.extract;
    } catch (error) {
        console.error("Failed to fetch from Wikipedia:", error);
        return null;
    }
};

export default function SpeciesDetailModal({ species, onClose }) {
    const { taxon, collection } = species;
    const [activeTab, setActiveTab] = useState('stats');
    const [description, setDescription] = useState(taxon.description || 'No description available. Checking Wikipedia...');
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

    useEffect(() => {
        let isMounted = true;
        if (!taxon.description) {
            fetchWikipediaSummary(taxon.name).then(summary => {
                if (isMounted && summary) {
                    setDescription(summary);
                    CollectionService.updateTaxonDescription(taxon.id, summary);
                } else if (isMounted) {
                    setDescription('No description found on Wikipedia.');
                }
            });
        }
        return () => { isMounted = false; };
    }, [taxon.id, taxon.name, taxon.description]);

    if (!species) return null;

    const accuracy = collection?.seenCount > 0 ? Math.round((collection.correctCount / collection.seenCount) * 100) : 0;
    const firstSeenAt = collection?.firstSeenAt ? new Date(collection.firstSeenAt).toLocaleDateString() : '—';
    const lastSeenAt = collection?.lastSeenAt ? new Date(collection.lastSeenAt).toLocaleDateString() : '—';
    const currentStreak = collection?.streak ?? 0;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <button className="modal-close-button" onClick={onClose}>&times;</button>
                <header className="modal-header">
                    <img src={headerImage} alt={taxon.name} className="modal-header-image" />
                    <div className="modal-header-overlay">
                        <div className="modal-title">
                            <h1 className="common-name">{taxon.preferred_common_name || taxon.name}</h1>
                            <p className="scientific-name">{taxon.name}</p>
                        </div>
                        <MasteryBadge level={collection?.masteryLevel || 0} />
                    </div>
                </header>
                <div className="modal-body">
                    <div className="tabs">
                        <button className={`tab-button ${activeTab === 'stats' ? 'active' : ''}`} onClick={() => setActiveTab('stats')}>My Stats</button>
                        <button className={`tab-button ${activeTab === 'encyclopedia' ? 'active' : ''}`} onClick={() => setActiveTab('encyclopedia')}>Encyclopedia</button>
                    </div>

                    {activeTab === 'stats' && collection && (
                        <div className="tab-content">
                            <div className="stat-grid">
                            <div className="stat-item">
                                    <div className="label">First Encounter</div>
                                    <div className="value">{firstSeenAt}</div>
                            </div>
                            <div className="stat-item">
                                    <div className="label">Last Seen</div>
                                    <div className="value">{lastSeenAt}</div>
                            </div>
                                <div className="stat-item">
                                    <div className="label">Times Seen</div>
                                    <div className="value">{collection.seenCount}</div>
                                </div>
                                <div className="stat-item">
                                    <div className="label">Correct IDs</div>
                                    <div className="value">{collection.correctCount}</div>
                                </div>
                                <div className="stat-item">
                                    <div className="label">Accuracy</div>
                                    <div className="value">{accuracy}%</div>
                                </div>
                            <div className="stat-item">
                                    <div className="label">Current Streak</div>
                                    <div className="value">{currentStreak}</div>
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
                                <a href={`https://www.inaturalist.org/taxa/${taxon.id}`} target="_blank" rel="noopener noreferrer">View on iNaturalist</a>
                                {taxon.wikipedia_url && <a href={taxon.wikipedia_url} target="_blank" rel="noopener noreferrer">View on Wikipedia</a>}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
