/* eslint-disable no-console */
import db, { speciesTable, statsTable } from './db';
import { loadProfileFromStore } from './PlayerProfile';

const LEGACY_STORAGE_KEY = 'inaturamouche_playerProfile';
const MIGRATION_FLAG_KEY = 'inaturamouche_collection_migration_done';
const MIGRATION_LOCK_KEY = 'inaturamouche_collection_migration_lock';
const MIGRATION_VERSION = 2;

const mapSpeciesEntry = (entry) => {
  const imageUrl =
    entry?.default_photo?.square_url ||
    entry?.default_photo?.url ||
    entry.square_url ||
    entry.thumbnail ||
    entry.imageUrl ||
    null;
  return {
    id: entry.id,
    name: entry.name,
    common_name: entry.common_name,
    preferred_common_name: entry.preferred_common_name,
    iconic_taxon_id: entry.iconic_taxon_id,
    ancestor_ids: Array.isArray(entry.ancestor_ids) ? entry.ancestor_ids : [],
    thumbnail: imageUrl,
    square_url: imageUrl,
    small_url: entry.small_url,
    medium_url: entry.medium_url,
  };
};

const mapStatsEntry = (entry) => {
  const seenCount = Number(entry.seenCount) || 0;
  const correctCount = Number(entry.correctCount) || 0;
  return {
    id: entry.id,
    seenCount,
    correctCount,
    lastSeenAt: entry.lastSeenAt,
    accuracy: seenCount > 0 ? correctCount / seenCount : 0,
  };
};

const extractPokedexEntries = (profile = {}) => {
  if (!profile || typeof profile !== 'object') return [];
  const pokedex = profile.pokedex;
  if (!pokedex || typeof pokedex !== 'object') {
    return [];
  }
  return Object.values(pokedex).filter((entry) => entry?.id);
};

export async function migrateLocalStorageToIndexedDB() {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return false;
  }
  const storedVersion = Number(localStorage.getItem(MIGRATION_FLAG_KEY));
  const hasCompletedMigration =
    !Number.isNaN(storedVersion) && storedVersion >= MIGRATION_VERSION;
  if (hasCompletedMigration) {
    try {
      const existingCount = await speciesTable.count();
      if (existingCount > 0) {
        return false;
      }
    } catch (countError) {
      console.warn('Collection migration: failed to verify species count', countError);
    }
  }
  if (localStorage.getItem(MIGRATION_LOCK_KEY) === 'in-progress') {
    return false;
  }
  localStorage.setItem(MIGRATION_LOCK_KEY, 'in-progress');
  let didImport = false;
  try {
    const uniqueEntries = new Map();

    const rawProfile = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (rawProfile) {
      try {
        const parsedProfile = JSON.parse(rawProfile);
        const legacyEntries = extractPokedexEntries(parsedProfile);
        legacyEntries.forEach((entry) => {
          if (entry?.id) {
            uniqueEntries.set(entry.id, entry);
          }
        });
      } catch (parseError) {
        console.warn('Collection migration: failed to parse legacy profile', parseError);
      }
    }

    try {
      const storedProfile = await loadProfileFromStore();
      const storedEntries = extractPokedexEntries(storedProfile);
      storedEntries.forEach((entry) => {
        if (entry?.id) {
          uniqueEntries.set(entry.id, entry);
        }
      });
    } catch (loadError) {
      console.warn('Collection migration: failed to load profile store', loadError);
    }

    if (uniqueEntries.size) {
      const entries = Array.from(uniqueEntries.values());
      await db.transaction('rw', speciesTable, statsTable, async () => {
        await speciesTable.bulkPut(entries.map(mapSpeciesEntry));
        await statsTable.bulkPut(entries.map(mapStatsEntry));
      });
      didImport = true;
    }
  } catch (error) {
    console.warn('Collection migration failed', error);
  } finally {
    localStorage.removeItem(MIGRATION_LOCK_KEY);
    localStorage.setItem(MIGRATION_FLAG_KEY, String(MIGRATION_VERSION));
  }
  return didImport;
}
