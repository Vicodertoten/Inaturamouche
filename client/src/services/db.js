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

// Export the db instance itself
export default db;
