import Dexie from 'dexie';

// Initialize Dexie Database
const db = new Dexie('inaturalist_quiz');

/**
 * Version 3: Clean schema with clear separation
 * - taxa: Encyclopedia (species data, mostly static)
 * - stats: Player progression (mastery, seen count, etc.)
 * Keep species/collection for backward compatibility during migration
 */
db.version(3).stores({
  /**
   * Encyclopedia of all taxa available in the game.
   * PK: id (iNaturalist taxon ID)
   * Indexed: iconic_taxon_id (for filtering by group), updatedAt (for stale cache detection)
   */
  taxa: 'id,iconic_taxon_id,updatedAt',

  /**
   * Player progression and stats per taxon.
   * PK: id (same as taxon.id)
   * Indexed: masteryLevel, lastSeenAt (for filtering), iconic_taxon_id (for roll-ups)
   */
  stats: 'id,masteryLevel,lastSeenAt,iconic_taxon_id',

  /**
   * Legacy collection table (kept for backward compatibility, migrated to stats)
   */
  collection: 'taxon_id,masteryLevel',

  /**
   * Legacy species table (kept for backward compatibility, merged into taxa)
   */
  species: 'id,iconic_taxon_id',

  /**
   * Cache for phylogenetic tree structures (kept if referenced elsewhere)
   */
  taxonomy_cache: 'id',

  /**
   * Legacy taxonomic group cache (kept if referenced elsewhere)
   */
  taxon_groups: 'id,parent_id',
});

// Version 4: Denormalized stats and search-friendly taxa
// - Denormalize stats to include iconic_taxon_id + composite indexes to enable
//   efficient queries that don't require pulling entire tables into memory.
// - Index `taxa.name` to enable startsWithIgnoreCase searches.
// Migration (upgrade) will populate iconic_taxon_id on existing stats entries.
db.version(4).stores({
  // Added `name` index for efficient text search
  taxa: 'id,iconic_taxon_id,updatedAt,name',

  // Denormalized stats: primary key id, iconic_taxon_id for grouping,
  // composite indexes for efficient sorting & pagination
  stats: 'id,iconic_taxon_id,[iconic_taxon_id+masteryLevel],[iconic_taxon_id+lastSeenAt],lastSeenAt',

  collection: 'taxon_id,masteryLevel',
  species: 'id,iconic_taxon_id',
  taxonomy_cache: 'id',
  taxon_groups: 'id,parent_id',
}).upgrade(async (trans) => {
  // Ensure existing stats entries have iconic_taxon_id populated so that
  // our new composite indexes work correctly on historical data.
  console.log('Running DB migration to v4: populating iconic_taxon_id on stats...');

  // Read all taxa (should be small for initial packs) and update corresponding stats
  const taxa = await trans.table('taxa').toArray();
  for (const t of taxa) {
    if (!t?.id) continue;
    const st = await trans.table('stats').get(t.id);
    if (st && (st.iconic_taxon_id === undefined || st.iconic_taxon_id === null)) {
      await trans.table('stats').put({ ...st, iconic_taxon_id: t.iconic_taxon_id ?? null });
    }
  }

  console.log('DB migration to v4 completed.');
});

/**
 * Version 5: Add active_session table for pause/resume functionality
 * - Stores a single active game session (id: 1)
 * - Contains: currentQuestionIndex, score, history, gameConfig, timestamp
 */
db.version(5).stores({
  taxa: 'id,iconic_taxon_id,updatedAt,name',
  stats: 'id,iconic_taxon_id,[iconic_taxon_id+masteryLevel],[iconic_taxon_id+lastSeenAt],lastSeenAt',
  collection: 'taxon_id,masteryLevel',
  species: 'id,iconic_taxon_id',
  taxonomy_cache: 'id',
  taxon_groups: 'id,parent_id',
  active_session: 'id',
});

/**
 * Helper function to retrieve stats for a taxon.
 * @param {number} taxonId - The iNaturalist taxon ID.
 * @returns {Promise<Object|null>}
 */
async function getStats(taxonId) {
  if (!taxonId) return null;
  return await db.stats.get(taxonId);
}

/**
 * Helper function to retrieve taxon data.
 * @param {number} taxonId - The iNaturalist taxon ID.
 * @returns {Promise<Object|null>}
 */
async function getTaxon(taxonId) {
  if (!taxonId) return null;
  return await db.taxa.get(taxonId);
}

/**
 * Helper function to get combined taxon + stats for display.
 * @param {number} taxonId - The iNaturalist taxon ID.
 * @returns {Promise<Object|null>}
 */
async function getTaxonWithStats(taxonId) {
  if (!taxonId) return null;
  const [taxon, stats] = await Promise.all([
    db.taxa.get(taxonId),
    db.stats.get(taxonId),
  ]);
  return taxon ? { taxon, stats: stats || null } : null;
}

// ============== Exports ==============

// Primary tables (new schema)
export const taxa = db.taxa;
export const stats = db.stats;
export const active_session = db.active_session;

// Legacy tables (kept for backward compatibility)
export const collection = db.collection;
export const speciesTable = db.species;
export const statsTable = db.stats; // Alias for consistency
export const taxonGroupsTable = db.taxon_groups;
export const taxonomy_cache = db.taxonomy_cache;

// Helper functions
export const helpers = {
  getStats,
  getTaxon,
  getTaxonWithStats,
};

/**
 * FIX #13: Check available storage quota
 * Returns quota information to prevent silent failures
 * @returns {Promise<{usage: number, quota: number, percentage: number, available: number}>}
 */
export async function checkStorageQuota() {
  if ('storage' in navigator && 'estimate' in navigator.storage) {
    try {
      const estimate = await navigator.storage.estimate();
      const usage = estimate.usage || 0;
      const quota = estimate.quota || 0;
      const percentage = quota > 0 ? (usage / quota) * 100 : 0;
      const available = quota - usage;
      
      return {
        usage,
        quota,
        percentage,
        available,
      };
    } catch (error) {
      console.warn('[DB] Failed to estimate storage quota:', error);
      return {
        usage: 0,
        quota: 0,
        percentage: 0,
        available: 0,
      };
    }
  }
  
  // Storage API not supported
  return {
    usage: 0,
    quota: 0,
    percentage: 0,
    available: 0,
  };
}

/**
 * FIX #13: Check if there's enough space before a write operation
 * @param {number} estimatedSize - Estimated size of the write in bytes
 * @returns {Promise<{hasSpace: boolean, quotaInfo: Object}>}
 */
export async function checkSpaceBeforeWrite(estimatedSize = 0) {
  const quotaInfo = await checkStorageQuota();
  
  // If quota is 0, we can't determine, so assume it's ok
  if (quotaInfo.quota === 0) {
    return { hasSpace: true, quotaInfo };
  }
  
  // Check if we have enough space (with 10% safety margin)
  const safetyMargin = quotaInfo.quota * 0.1;
  const hasSpace = quotaInfo.available > (estimatedSize + safetyMargin);
  
  // Warn if running low on space (>80% used)
  if (quotaInfo.percentage > 80) {
    console.warn(`[DB] Storage usage high: ${quotaInfo.percentage.toFixed(1)}%`);
  }
  
  return { hasSpace, quotaInfo };
}

// Export the db instance itself
export default db;
