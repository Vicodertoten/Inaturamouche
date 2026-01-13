import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { AutoSizer } from 'react-virtualized-auto-sizer';
import { Grid as FixedSizeGrid } from 'react-window';

import { speciesTable, statsTable } from '../services/db';
import { ICONIC_TAXA_LIST } from '../utils/collectionUtils';
import CollectionCard from '../components/CollectionCard';
import SpeciesDetailModal from '../components/SpeciesDetailModal';
import './CollectionPage.css';

const COLUMN_WIDTH = 180;
const ROW_HEIGHT = 220;

// Component for an item in the species grid
const GridCell = ({ columnIndex, rowIndex, style, data }) => {
  const { species, columnCount, onSpeciesSelect } = data;
  const index = rowIndex * columnCount + columnIndex;
  if (index >= species.length) return null;

  const speciesData = species[index];
  const { taxon, collection } = speciesData;

  // react-window passes style with position: absolute.
  // To make the cell clickable, we need a div inside that.
  const innerStyle = {
      ...style,
      top: `${parseFloat(style.top) + 5}px`,
      left: `${parseFloat(style.left) + 5}px`,
      width: `${parseFloat(style.width) - 10}px`,
      height: `${parseFloat(style.height) - 10}px`,
  };

  return (
    <div style={innerStyle} onClick={() => onSpeciesSelect(speciesData)}>
        <CollectionCard
          taxon={taxon}
          collection={collection}
        />
    </div>
  );
};


function SpeciesGrid({ iconicTaxonId, onBack, onSpeciesSelect }) {
  const allSpecies = useLiveQuery(
    () =>
      speciesTable
        .where('iconic_taxon_id')
        .equals(iconicTaxonId)
        .or('iconic_taxon_id')
        .equals(String(iconicTaxonId))
        .toArray(),
    [iconicTaxonId]
  );

  const allCollection = useLiveQuery(
    () => statsTable.toArray().then(entries => new Map(entries.map(e => [e.id, e]))),
    []
  );

  const species = useMemo(() => {
    if (!allSpecies || !allCollection) return [];
    return allSpecies.map(taxon => ({
      taxon,
      collection: allCollection.get(taxon.id)
    })).filter(item => item.collection); // Only show collected species
  }, [allSpecies, allCollection]);
  
  const iconicTaxonName = ICONIC_TAXA_LIST.find(t => t.id === iconicTaxonId)?.name || 'Collection';

  return (
    <>
      <div className="collection-header">
        <button onClick={onBack} className="back-button">&larr; Back</button>
        <h1>{iconicTaxonName}</h1>
      </div>
      <div className="species-grid-container">
        <AutoSizer>
          {({ height, width }) => {
            const columnCount = Math.max(1, Math.floor(width / COLUMN_WIDTH));
            const rowCount = Math.ceil(species.length / columnCount);
            return (
              <FixedSizeGrid
                columnCount={columnCount}
                columnWidth={COLUMN_WIDTH}
                rowCount={rowCount}
                rowHeight={ROW_HEIGHT}
                height={height}
                width={width}
                itemData={{ species, columnCount, onSpeciesSelect }}
              >
                {GridCell}
              </FixedSizeGrid>
            );
          }}
        </AutoSizer>
      </div>
    </>
  );
}

function IconicTaxaGrid({ onSelect }) {
    const summary = useLiveQuery(async () => {
        const collectedStats = await statsTable.toArray();
        if (collectedStats.length === 0) return {};

        const collectedTaxonIds = collectedStats.map(entry => entry.id);
        const taxaInCollection = await speciesTable.where('id').anyOf(collectedTaxonIds).toArray();
        
        const collectedCounts = {};
        for(const taxon of taxaInCollection) {
            if (!taxon?.iconic_taxon_id) continue;
            collectedCounts[taxon.iconic_taxon_id] = (collectedCounts[taxon.iconic_taxon_id] || 0) + 1;
        }

        return collectedCounts;
    }, []);

  return (
    <>
      <div className="collection-header">
        <h1>Living Atlas</h1>
      </div>
      <div className="iconic-taxa-grid">
        {ICONIC_TAXA_LIST.map(taxon => (
          <div key={taxon.id} className="iconic-taxon-card" onClick={() => onSelect(taxon.id)}>
            <h2>{taxon.name}</h2>
            <p>{summary?.[taxon.id] || 0} Species</p>
          </div>
        ))}
      </div>
    </>
  );
}


export default function CollectionPage() {
  const [selectedIconicTaxonId, setSelectedIconicTaxonId] = useState(null);
  const [modalSpecies, setModalSpecies] = useState(null);

  const handleSelectIconicTaxon = (taxonId) => {
    setSelectedIconicTaxonId(taxonId);
  }

  const handleBack = () => {
    setSelectedIconicTaxonId(null);
  }

  const handleCloseModal = () => {
    setModalSpecies(null);
  }

  return (
    <div className="collection-page">
      {selectedIconicTaxonId ? (
        <SpeciesGrid 
          iconicTaxonId={selectedIconicTaxonId} 
          onBack={handleBack}
          onSpeciesSelect={setModalSpecies}
        />
      ) : (
        <IconicTaxaGrid onSelect={handleSelectIconicTaxon} />
      )}
      {modalSpecies && <SpeciesDetailModal species={modalSpecies} onClose={handleCloseModal} />}
    </div>
  );
}
