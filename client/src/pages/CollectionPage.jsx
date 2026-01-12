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
const GRID_CARD_MIN_WIDTH = 200;
const GRID_CARD_HEIGHT = 240;
const LIST_ITEM_HEIGHT = 78;
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
      }}
    />
    <div className="folder-meta">
      <p className="folder-name">{folder.name}</p>
      <p className="folder-rank">{folder.rank || 'Taxon'}</p>
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
        aria-label={`Voir ${getSpeciesName(record)}`}
      >
        <div
          className="species-card-image"
          style={{
            backgroundImage: record.square_url
              ? `url(${record.square_url})`
              : record.thumbnail
                ? `url(${record.thumbnail})`
                : 'none',
          }}
        />
        <div className="species-card-body">
          <p className="species-name">{getSpeciesName(record)}</p>
          <p className="species-scientific-name">{record.name}</p>
          <p className="species-stats">
            Vus: {record.seenCount ?? 0} · Corrects: {record.correctCount ?? 0}
          </p>
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
        aria-label={`Voir ${getSpeciesName(record)}`}
      >
        <div
          className="species-row-image"
          style={{
            backgroundImage: record.small_url
              ? `url(${record.small_url})`
              : record.thumbnail
                ? `url(${record.thumbnail})`
                : 'none',
          }}
        />
        <div className="species-row-body">
          <p className="species-name">{getSpeciesName(record)}</p>
          <p className="species-scientific-name">{record.name}</p>
          <p className="species-stats">
            Vus: {record.seenCount ?? 0} · Corrects: {record.correctCount ?? 0}
          </p>
        </div>
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
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const buildBreadcrumbs = useCallback(async (folder) => {
    const trail = [ROOT_BREADCRUMB];
    if (!folder) {
      return trail;
    }
    const ancestors = [];
    let cursor = folder;
    while (cursor) {
      ancestors.unshift(cursor);
      if (!cursor.parent_id) break;
      // eslint-disable-next-line no-await-in-loop
      cursor = await taxonGroupsTable.get(cursor.parent_id);
    }
    return trail.concat(ancestors);
  }, []);

  const loadFolder = useCallback(async (folderId = null) => {
    if (!isMountedRef.current) return;
    currentFolderIdRef.current = folderId ?? null;
    setIsLoading(true);
    try {
      const folder = folderId ? await taxonGroupsTable.get(folderId) : null;
      const breadcrumbChain = await buildBreadcrumbs(folder);
      const totalCount = folder
        ? await speciesTable.where('ancestor_ids').equals(folder.id).count()
        : await speciesTable.count();
      const rawChildren =
        folderId == null
          ? (
              await taxonGroupsTable.toArray()
            ).filter((child) => child.parent_id == null)
          : await taxonGroupsTable.where('parent_id').equals(folderId).toArray();
      const enrichedChildren = await Promise.all(
        rawChildren.map(async (child) => {
          const count = await speciesTable.where('ancestor_ids').equals(child.id).count();
          const preview = await speciesTable.where('ancestor_ids').equals(child.id).first();
          return {
            ...child,
            speciesCount: count,
            previewThumbnail: preview?.small_url || preview?.thumbnail || preview?.square_url || null,
          };
        })
      );
      enrichedChildren.sort((a, b) => (b.speciesCount ?? 0) - (a.speciesCount ?? 0));
      const showSpecies =
        totalCount <= SPECIES_THRESHOLD_FOR_SUBFOLDERS || enrichedChildren.length === 0;
      let speciesToDisplay = [];
      if (showSpecies) {
        const rawSpecies = folderId
          ? await speciesTable.where('ancestor_ids').equals(folder.id).toArray()
          : await speciesTable.toArray();
        const sorted = sortSpeciesList(rawSpecies);
        const ids = sorted.map((record) => record.id).filter(Boolean);
        const statsRecords = ids.length ? await statsTable.bulkGet(ids) : [];
        const statsMap = new Map();
        ids.forEach((id, index) => {
          statsMap.set(id, statsRecords[index] || null);
        });
        speciesToDisplay = sorted.map((record) => {
          const stats = statsMap.get(record.id);
          return {
            ...record,
            seenCount: stats?.seenCount ?? 0,
            correctCount: stats?.correctCount ?? 0,
            accuracy: stats?.accuracy ?? 0,
            lastSeenAt: stats?.lastSeenAt ?? null,
          };
        });
      }
      if (!isMountedRef.current) return;
      setActiveFolder(folder);
      setBreadcrumbs(breadcrumbChain);
      setFolderSpeciesCount(totalCount);
      setChildFolders(enrichedChildren);
      setShouldShowSpecies(showSpecies);
      setSpeciesList(showSpecies ? speciesToDisplay : []);
    } catch (error) {
      console.error('Erreur lors du chargement du dossier', error);
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [buildBreadcrumbs]);

  const refreshStats = useCallback(async () => {
    try {
      const stats = await getCollectionStats();
      if (isMountedRef.current) {
        setCollectionStats(stats);
      }
    } catch (error) {
      console.error('Impossible de lire les statistiques de la collection', error);
    }
  }, [getCollectionStats]);

  useEffect(() => {
    void loadFolder(currentFolderIdRef.current);
    void refreshStats();
  }, [collectionVersion, loadFolder, refreshStats]);

  const handleFolderSelect = (folder) => {
    void loadFolder(folder?.id ?? null);
  };

  const handleBreadcrumbClick = (crumb) => {
    if (crumb.id === activeFolder?.id) return;
    void loadFolder(crumb.id ?? null);
  };

  const handleSpeciesSelect = useCallback((record) => {
    setSelectedSpecies(record);
  }, []);

  const closeSpeciesModal = useCallback(() => {
    setSelectedSpecies(null);
  }, []);

  const badgeCount = collectionStats?.totalSpecies ?? 0;
  const masteredCount = collectionStats?.masteredSpecies ?? 0;

  const breadcrumbTrail = useMemo(
    () =>
      breadcrumbs.map((crumb, index) => ({
        ...crumb,
        isLast: index === breadcrumbs.length - 1,
      })),
    [breadcrumbs]
  );

  return (
    <div className="collection-page">
      <header className="collection-header">
        <p className="collection-eyebrow">À bout de filet</p>
        <h1>Grand Classeur Naturaliste</h1>
        <p className="collection-subtitle">
          {badgeCount.toLocaleString()} espèces collectées · {masteredCount.toLocaleString()} maîtrisées
        </p>
        <p className="collection-subtitle">
          Dernier aperçu : {formatLastSeen(collectionStats?.lastSeenAt)}
        </p>
      </header>

      <nav className="breadcrumbs" aria-label="Chemin de navigation">
        {breadcrumbTrail.map((crumb) => (
          <React.Fragment key={crumb.id ?? 'root'}>
            <button
              type="button"
              className={`breadcrumb ${crumb.isLast ? 'breadcrumb-active' : ''}`}
              onClick={() => handleBreadcrumbClick(crumb)}
            >
              {crumb.name}
            </button>
            {!crumb.isLast && <span className="breadcrumb-separator">/</span>}
          </React.Fragment>
        ))}
      </nav>

      <section className="collection-body">
        <div className="collection-meta-row">
          <div>
            <p className="collection-meta-label">
              Dossier : {activeFolder?.name || 'Collection complète'}
            </p>
            <p className="collection-meta-value">{folderSpeciesCount.toLocaleString()} espèces</p>
          </div>
          {shouldShowSpecies && speciesList.length > 0 && (
            <div className="view-mode-toggle" role="group" aria-label="Mode d'affichage">
              <button
                type="button"
                className={viewMode === VIEW_MODES.ALBUM ? 'toggle-active' : ''}
                onClick={() => setViewMode(VIEW_MODES.ALBUM)}
              >
                Mode Album
              </button>
              <button
                type="button"
                className={viewMode === VIEW_MODES.LIST ? 'toggle-active' : ''}
                onClick={() => setViewMode(VIEW_MODES.LIST)}
              >
                Mode Liste
              </button>
            </div>
          )}
        </div>

        {isLoading && (
          <div className="collection-loading">
            <p>Chargement de la collection…</p>
          </div>
        )}

        {!isLoading &&
          !shouldShowSpecies &&
          childFolders.length > 0 &&
          folderSpeciesCount > SPECIES_THRESHOLD_FOR_SUBFOLDERS && (
          <div className="folder-grid">
            {childFolders.map((folder) => (
              <FolderCard key={folder.id} folder={folder} onNavigate={handleFolderSelect} />
            ))}
          </div>
        )}

        {!isLoading && shouldShowSpecies && speciesList.length > 0 && (
          <div className="species-view">
            {viewMode === VIEW_MODES.ALBUM ? (
              <AutoSizer>
                {({ height, width }) => {
                  const columnCount = Math.max(1, Math.floor(width / GRID_CARD_MIN_WIDTH));
                  return (
                <FixedSizeGrid
                  columnCount={columnCount}
                  columnWidth={Math.floor(width / columnCount)}
                  rowCount={Math.ceil(speciesList.length / columnCount)}
                  rowHeight={GRID_CARD_HEIGHT}
                  height={height}
                  width={width}
                  itemData={{ species: speciesList, columnCount, onSelect: handleSpeciesSelect }}
                >
                  {AlbumCell}
                </FixedSizeGrid>
              );
            }}
          </AutoSizer>
        ) : (
          <AutoSizer>
            {({ height, width }) => (
              <FixedSizeList
                height={height}
                width={width}
                itemCount={speciesList.length}
                itemSize={LIST_ITEM_HEIGHT}
                itemData={{ species: speciesList, onSelect: handleSpeciesSelect }}
              >
                {ListRow}
              </FixedSizeList>
            )}
          </AutoSizer>
        )}
      </div>
        )}

        {!isLoading && shouldShowSpecies && speciesList.length === 0 && (
          <div className="collection-empty">
            <p>Pas encore d'espèce enregistrée dans ce dossier. Reviens après une expédition !</p>
          </div>
        )}

        {!isLoading && !childFolders.length && !speciesList.length && (
          <div className="collection-empty">
            <p>Tu n'as encore rien collecté dans ce dossier. Reviens après une sortie sur le terrain !</p>
          </div>
        )}
      </section>
      {selectedSpecies && (
        <SpeciesDetailModal species={selectedSpecies} onClose={closeSpeciesModal} />
      )}
    </div>
  );
}
