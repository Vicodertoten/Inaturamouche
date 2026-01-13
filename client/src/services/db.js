import Dexie from 'dexie';

// Initialize Dexie Database
const db = new Dexie('inaturalist_quiz');

db.version(1).stores({
  /**
   * Encyclopedia of all taxa available in the game.
   * This data is mostly static and readonly.
   */
  taxa: 'id,name,iconic_taxon_id',

  /**
   * Player's collection, tracking progress for each taxon.
   * This data is dynamic and frequently updated.
   */
  collection: 'taxon_id,masteryLevel',

  /**
   * Cache for phylogenetic tree structures.
   */
  taxonomy_cache: 'id',
});

db.version(2).stores({
  taxa: 'id,name,iconic_taxon_id',
  collection: 'taxon_id,masteryLevel',
  taxonomy_cache: 'id',

  /**
   * Species payload for richer details (photos, ancestor references, etc.).
   */
  species: 'id,iconic_taxon_id',

  /**
   * Stats table used for mastery tracking.
   */
  stats: 'id,masteryLevel,seenCount,correctCount',

  /**
   * Taxonomic group cache for ancestor data.
   */
  taxon_groups: 'id,parent_id',
});

/**
 * Retrieves the statistics for a given taxon ID.
 * This function will not perform a join, as it's more efficient
 * to query the collection directly. The full taxon data can be fetched
 * separately from the `taxa` table if needed.
 *
 * @param {number} taxonId - The iNaturalist taxon ID.
 * @returns {Promise<Object|null>} A promise that resolves to the stats object or null if not found.
 */
async function getStats(taxonId) {
  if (!taxonId) return null;
  return await db.collection.get(taxonId);
}

// Export tables for external use
export const taxa = db.taxa;
export const collection = db.collection;
export const speciesTable = db.species;
export const statsTable = db.stats;
export const taxonGroupsTable = db.taxon_groups;
export const taxonomy_cache = db.taxonomy_cache;

// Export helper functions
export const helpers = {
  getStats,
};

// Export the db instance itself
export default db;
