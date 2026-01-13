import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AutoSizer } from 'react-virtualized-auto-sizer';
import { Grid as FixedSizeGrid, List as FixedSizeList } from 'react-window';
import { speciesTable, statsTable, taxonGroupsTable } from '../services/db';
import { useUser } from '../context/UserContext';
import SpeciesDetailModal from '../components/SpeciesDetailModal';
import { MASTERY_THRESHOLD } from '../utils/scoring';
import './CollectionPage.css';

const VIEW_MODES = {
  ALBUM: 'album',
  LIST: 'list',
};

const SPECIES_THRESHOLD_FOR_SUBFOLDERS = 30;
const GRID_CARD_MIN_WIDTH = 180;
const GRID_CARD_HEIGHT = 260;
const LIST_ITEM_HEIGHT = 80;
const ROOT_BREADCRUMB = { id: null, name: 'Collection', rank: 'root' };

const getSpeciesName = (species) =>
  species?.preferred_common_name ||
  species?.common_name ||
  species?.name ||
  'Espèce inconnue';

const sortSpeciesList = (list) =>
  list.slice().sort((a, b) => getSpeciesName(a).localeCompare(getSpeciesName(b), 'fr', { sensitivity: 'base' }));

const formatLastSeen = (value) => {
  if (!value) return 'Jamais vu';
  const date = new Date(value);
  return date.toLocaleDateString('fr-FR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

const getFrameClass = (record) => {
  const seen = record?.seenCount ?? 0;
  const correct = record?.correctCount ?? 0;
  if (correct >= MASTERY_THRESHOLD) return 'gold-frame';
  if (seen >= 5) return 'silver-frame';
  if (seen >= 1) return 'bronze-frame';
  return '';
};

const FolderCard = ({ folder, onNavigate }) => (
  <button className="folder-card" type="button" onClick={() => onNavigate(folder)}>
    <div
      className="folder-preview"
      style={{
        backgroundImage: folder.previewThumbnail ? `url(${folder.previewThumbnail})` : 'none',
        backgroundSize: 'cover',
        height: '100px',
        borderRadius: '4px'
      }}
    />
    <div className="folder-meta">
      <p className="folder-name">{folder.name}</p>
      <span className="folder-count">{folder.speciesCount ?? 0} espèces</span>
    </div>
  </button>
);

const AlbumCell = ({ columnIndex, rowIndex, style, data }) => {
  const { species, columnCount, onSelect } = data;
  const idx = rowIndex * columnCount + columnIndex;
  if (idx >= species.length) return null;
  const record = species[idx];
  const frameClass = getFrameClass(record);
  
  return (
    <div style={style} className="species-cell">
      <button
        type="button"
        className={`species-card album-mode ${frameClass}`}
        onClick={() => onSelect(record)}
      >
        <div
          className="species-card-image"
          style={{
            backgroundImage: record.square_url ? `url(${record.square_url})` : 'none',
          }}
        />
        <div className="species-card-body">
          <p className="species-name">{getSpeciesName(record)}</p>
          <p className="species-scientific-name">{record.name}</p>
        </div>
      </button>
    </div>
  );
};

const ListRow = ({ index, style, data }) => {
  const { species, onSelect } = data;
  const record = species[index];
  if (!record) return null;
  const frameClass = getFrameClass(record);
  
  return (
    <div className="species-row" style={style}>
      <button
        className={`species-row-inner ${frameClass}`}
        type="button"
        onClick={() => onSelect(record)}
      >
        <p className="species-name">{getSpeciesName(record)}</p>
      </button>
    </div>
  );
};

export function CollectionPage() {
  const { getCollectionStats, collectionVersion } = useUser();
  const [activeFolder, setActiveFolder] = useState(null);
  const [breadcrumbs, setBreadcrumbs] = useState([ROOT_BREADCRUMB]);
  const [childFolders, setChildFolders] = useState([]);
  const [speciesList, setSpeciesList] = useState([]);
  const [shouldShowSpecies, setShouldShowSpecies] = useState(false);
  const [folderSpeciesCount, setFolderSpeciesCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [collectionStats, setCollectionStats] = useState(null);
  const [viewMode, setViewMode] = useState(VIEW_MODES.ALBUM);
  const [selectedSpecies, setSelectedSpecies] = useState(null);
  
  const isMountedRef = useRef(true);
  const currentFolderIdRef = useRef(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  const buildBreadcrumbs = useCallback(async (folder) => {
    const trail = [ROOT_BREADCRUMB];
    if (!folder) return trail;
    // Logique simplifiée pour l'instant (pas de remontee recursive complete)
    trail.push(folder);
    return trail;
  }, []);

  const loadFolder = useCallback(async (folderId = null) => {
    if (!isMountedRef.current) return;
    currentFolderIdRef.current = folderId;
    setIsLoading(true);
    
    try {
      // 1. Charger Dossier & Count
      const folder = folderId ? await taxonGroupsTable.get(folderId) : null;
      const totalCount = folder
        ? await speciesTable.where('ancestor_ids').equals(folder.id).count()
        : await speciesTable.count();

      // 2. Charger Espèces (Si pas de sous-dossiers ou threshold)
      // Note: Pour cette étape on affiche TOUJOURS les espèces s'il n'y a pas de taxon_groups créés
      // Comme la Phase 2 (Taxonomie) n'est pas encore active, taxonGroupsTable est vide.
      // Donc on affiche tout.
      
      const rawSpecies = folderId
        ? await speciesTable.where('ancestor_ids').equals(folder.id).toArray()
        : await speciesTable.toArray();
        
      const sorted = sortSpeciesList(rawSpecies);
      
      // Hydrater avec les stats
      const ids = sorted.map(r => r.id);
      const stats = await statsTable.bulkGet(ids);
      const enriched = sorted.map((r, i) => ({
        ...r,
        ...stats[i]
      }));

      if (!isMountedRef.current) return;
      
      setActiveFolder(folder);
      setFolderSpeciesCount(totalCount);
      setSpeciesList(enriched);
      setShouldShowSpecies(true); // On force l'affichage car pas encore de dossiers
      setBreadcrumbs(await buildBreadcrumbs(folder));
      
    } catch (error) {
      console.error('Erreur chargement dossier', error);
    } finally {
      if (isMountedRef.current) setIsLoading(false);
    }
  }, [buildBreadcrumbs]);

  const refreshStats = useCallback(async () => {
    try {
      const stats = await getCollectionStats();
      if (isMountedRef.current) setCollectionStats(stats);
    } catch (e) { console.error(e); }
  }, [getCollectionStats]);

  useEffect(() => {
    void loadFolder(null);
    void refreshStats();
  }, [collectionVersion, loadFolder, refreshStats]);

  return (
    <div className="collection-page">
      <header className="collection-header">
        <p className="collection-eyebrow">À bout de filet</p>
        <h1>Grand Classeur Naturaliste</h1>
        <p className="collection-subtitle">
          {collectionStats?.totalSpecies || 0} espèces collectées
        </p>
      </header>

      <div className="collection-body">
        <div className="collection-meta-row">
          <span className="collection-meta-value">
            {activeFolder?.name || 'Tout voir'} ({speciesList.length})
          </span>
          <div className="view-mode-toggle">
            <button 
              className={viewMode === VIEW_MODES.ALBUM ? 'toggle-active' : ''}
              onClick={() => setViewMode(VIEW_MODES.ALBUM)}
            >
              Grille
            </button>
            <button 
              className={viewMode === VIEW_MODES.LIST ? 'toggle-active' : ''}
              onClick={() => setViewMode(VIEW_MODES.LIST)}
            >
              Liste
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="collection-loading">Chargement...</div>
        ) : speciesList.length === 0 ? (
          <div className="collection-empty">Ta collection est vide. Va jouer !</div>
        ) : (
          <div className="species-view">
            <AutoSizer>
              {({ height, width }) => {
                if (viewMode === VIEW_MODES.LIST) {
                  return (
                    <FixedSizeList
                      height={height}
                      width={width}
                      itemCount={speciesList.length}
                      itemSize={LIST_ITEM_HEIGHT}
                      itemData={{ species: speciesList, onSelect: setSelectedSpecies }}
                    >
                      {ListRow}
                    </FixedSizeList>
                  );
                }
                const columnCount = Math.max(2, Math.floor(width / GRID_CARD_MIN_WIDTH));
                const rowCount = Math.ceil(speciesList.length / columnCount);
                return (
                  <FixedSizeGrid
                    columnCount={columnCount}
                    columnWidth={width / columnCount}
                    rowCount={rowCount}
                    rowHeight={GRID_CARD_HEIGHT}
                    height={height}
                    width={width}
                    itemData={{ species: speciesList, columnCount, onSelect: setSelectedSpecies }}
                  >
                    {AlbumCell}
                  </FixedSizeGrid>
                );
              }}
            </AutoSizer>
          </div>
        )}
      </div>

      {selectedSpecies && (
        <SpeciesDetailModal 
          species={selectedSpecies} 
          onClose={() => setSelectedSpecies(null)} 
        />
      )}
    </div>
  );
}