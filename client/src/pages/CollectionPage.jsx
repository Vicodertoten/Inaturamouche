import React, { useState, useMemo, useEffect } from 'react';
import { useUser } from '../context/UserContext';
import { groupTaxaByIconic } from '../utils/collectionUtils';
import { getTaxaByIds } from '../services/api';
import './CollectionPage.css';
import Spinner from '../components/Spinner';

const Accordion = ({ title, count, children, isOpen, onToggle }) => (
  <div className="accordion-item">
    <button className="accordion-header" onClick={onToggle}>
      <span className="accordion-title">{title}</span>
      <span className="accordion-count">{count}</span>
      <span className={`accordion-icon ${isOpen ? 'open' : ''}`}>▼</span>
    </button>
    {isOpen && <div className="accordion-content">{children}</div>}
  </div>
);

const SpeciesCard = ({ species }) => (
  <div className="species-card">
    <img src={species.thumbnail} alt={species.common_name || species.name} loading="lazy" />
    <div className="species-info">
      <p className="species-name">{species.common_name || species.name}</p>
      <p className="species-scientific-name">{species.name}</p>
      <p className="species-stats">
        Vus: {species.seenCount} | Corrects: {species.correctCount}
      </p>
    </div>
  </div>
);

export function CollectionPage() {
  const { profile, updateProfile } = useUser();
  const { pokedex } = profile || {};
  const [searchTerm, setSearchTerm] = useState('');
  const [openGroups, setOpenGroups] = useState(new Set());
  const [isBackfilling, setIsBackfilling] = useState(false);

  useEffect(() => {
    const backfill = async () => {
      const entriesToBackfill = Object.values(pokedex || {}).filter(entry => entry.id && !entry.iconic_taxon_id);
      if (entriesToBackfill.length === 0) return;

      setIsBackfilling(true);
      const idsToFetch = entriesToBackfill.map(entry => entry.id);
      
      try {
        const taxaDetails = await getTaxaByIds(idsToFetch);
        const taxaById = taxaDetails.reduce((acc, taxon) => {
          acc[taxon.id] = taxon;
          return acc;
        }, {});

        updateProfile(currentProfile => {
          const newPokedex = { ...(currentProfile.pokedex || {}) };
          let updated = false;
          Object.values(newPokedex).forEach(entry => {
            if (entry.id && !entry.iconic_taxon_id && taxaById[entry.id]) {
              const details = taxaById[entry.id];
              entry.iconic_taxon_id = details.iconic_taxon_id;
              entry.ancestor_ids = details.ancestor_ids;
              if (!entry.name) entry.name = details.name;
              if (!entry.common_name) entry.common_name = details.preferred_common_name;
              updated = true;
            }
          });
          return updated ? { ...currentProfile, pokedex: newPokedex } : currentProfile;
        });
      } catch (error) {
        console.error("Failed to backfill pokedex data", error);
      } finally {
        setIsBackfilling(false);
      }
    };

    if (pokedex && Object.keys(pokedex).length > 0) {
      backfill();
    }
  }, [pokedex, updateProfile]);

  const filteredPokedex = useMemo(() => {
    if (!pokedex) return {};
    if (!searchTerm) return pokedex;

    const lowerCaseSearch = searchTerm.toLowerCase();
    return Object.values(pokedex).filter(species =>
      (species.name?.toLowerCase().includes(lowerCaseSearch)) ||
      (species.common_name?.toLowerCase().includes(lowerCaseSearch))
    ).reduce((acc, species) => {
      acc[species.id] = species;
      return acc;
    }, {});
  }, [pokedex, searchTerm]);

  const groupedAndSortedTaxa = useMemo(() => {
    return groupTaxaByIconic(filteredPokedex);
  }, [filteredPokedex]);

  useEffect(() => {
    if (searchTerm) {
      const newOpenGroups = new Set(groupedAndSortedTaxa.map(g => g.label));
      setOpenGroups(newOpenGroups);
    } else {
      setOpenGroups(new Set());
    }
  }, [searchTerm, groupedAndSortedTaxa]);

  const toggleGroup = (label) => {
    setOpenGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(label)) {
        newSet.delete(label);
      } else {
        newSet.add(label);
      }
      return newSet;
    });
  };

  const totalSpecies = pokedex ? Object.keys(pokedex).length : 0;

  return (
    <div className="collection-page">
      <header className="collection-header">
        <h1>Grand Classeur Naturaliste</h1>
        <p>Espèces collectées : {totalSpecies}</p>
        <div className="search-bar">
          <input
            type="text"
            placeholder="Rechercher une espèce..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </header>

      {isBackfilling && (
        <div style={{ display: 'flex', justifyContent: 'center', margin: '2rem' }}>
          <Spinner /> <span>Mise à jour des données...</span>
        </div>
      )}

      <div className="collection-list">
        {groupedAndSortedTaxa.map(group => (
          <Accordion
            key={group.label}
            title={`${group.emoji} ${group.label}`}
            count={group.species.length}
            isOpen={openGroups.has(group.label)}
            onToggle={() => toggleGroup(group.label)}
          >
            <div className="species-grid">
              {group.species.map(species => (
                <SpeciesCard key={species.id} species={species} />
              ))}
            </div>
          </Accordion>
        ))}
        {totalSpecies > 0 && searchTerm && groupedAndSortedTaxa.length === 0 && <p>Aucun résultat pour "{searchTerm}"</p>}
        {totalSpecies === 0 && <p>Aucune espèce collectée pour le moment. Jouez pour en découvrir !</p>}
      </div>
    </div>
  );
}
