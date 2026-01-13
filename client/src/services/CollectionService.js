import db, { taxa as taxaTable, stats as statsTable } from './db.js';
import { queueTaxonForEnrichment } from './TaxonomyService.js';

// ============== MASTERY CONSTANTS ==============

export const MASTERY_LEVELS = Object.freeze({
  NONE: 0,
  BRONZE: 1,    // Discovery
  SILVER: 2,    // Familiar
  GOLD: 3,      // Expert
  DIAMOND: 4,   // Master (Reserved for Hard Mode)
});

export const MASTERY_NAMES = Object.freeze({
  0: 'Unseen',
  1: 'Bronze',
  2: 'Silver',
  3: 'Gold',
  4: 'Diamond',
});

export const MASTERY_THRESHOLDS = Object.freeze({
  [MASTERY_LEVELS.BRONZE]: { correct: 1, ratio: 0 },
  [MASTERY_LEVELS.SILVER]: { correct: 5, ratio: 0 },
  [MASTERY_LEVELS.GOLD]: { correct: 10, ratio: 0.8 },
  [MASTERY_LEVELS.DIAMOND]: { correct: 20, ratio: 0.95 },
});

const PLACEHOLDER_IMAGE_URL = '/placeholder.svg';
const BROADCAST_CHANNEL_NAME = 'COLLECTION_UPDATED';

// ============== INTERNAL HELPERS ==============

/**
 * Calculate mastery level based on stats.
 * @param {number} correctCount
 * @param {number} seenCount
 * @returns {number} MASTERY_LEVELS
 */
function _calculateMasteryLevel(correctCount = 0, seenCount = 0) {
  const ratio = seenCount > 0 ? correctCount / seenCount : 0;

  if (
    correctCount >= MASTERY_THRESHOLDS[MASTERY_LEVELS.GOLD].correct &&
    ratio >= MASTERY_THRESHOLDS[MASTERY_LEVELS.GOLD].ratio
  ) {
    return MASTERY_LEVELS.GOLD;
  }
  if (correctCount >= MASTERY_THRESHOLDS[MASTERY_LEVELS.SILVER].correct) {
    return MASTERY_LEVELS.SILVER;
  }
  if (correctCount >= MASTERY_THRESHOLDS[MASTERY_LEVELS.BRONZE].correct) {
    return MASTERY_LEVELS.BRONZE;
  }
  return MASTERY_LEVELS.NONE;
}

/**
 * Broadcast collection update to other tabs.
 */
function _broadcastUpdate(eventType = 'COLLECTION_UPDATED') {
  if (typeof BroadcastChannel !== 'undefined') {
    try {
      const channel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
      channel.postMessage({ type: eventType, timestamp: Date.now() });
      channel.close();
    } catch (err) {
      console.warn('BroadcastChannel not available:', err);
    }
  }
}

/**
 * Extract best image URL from taxon data (from iNaturalist API).
 */
function _getBestImageUrl(taxonData) {
  return (
    taxonData?.medium_url ||
    taxonData?.picture_url_medium ||
    taxonData?.small_url ||
    taxonData?.picture_url_small ||
    taxonData?.square_url ||
    taxonData?.thumbnail ||
    taxonData?.default_photo?.medium_url ||
    taxonData?.default_photo?.small_url ||
    taxonData?.default_photo?.square_url ||
    taxonData?.default_photo?.url ||
    PLACEHOLDER_IMAGE_URL
  );
}

// ============== PUBLIC API ==============

/**
 * Seed taxa into the database (encyclopedia preload).
 * Useful for bulk loading ICONIC_TAXA or a full dump.
 * @param {Array<Object>} taxonList
 * @param {Object} opts - { onProgress: (count) => void }
 */
export async function seedTaxa(taxonList, opts = {}) {
  const { onProgress } = opts;
  if (!Array.isArray(taxonList) || taxonList.length === 0) return;

  try {
    let batchSize = 100;
    for (let i = 0; i < taxonList.length; i += batchSize) {
      const batch = taxonList.slice(i, i + batchSize);
      await db.transaction('rw', taxaTable, async () => {
        for (const taxon of batch) {
          if (!taxon?.id) continue;
          await taxaTable.put({
            id: taxon.id,
            name: taxon.name,
            preferred_common_name: taxon.preferred_common_name || taxon.name,
            rank: taxon.rank || 'unknown',
            iconic_taxon_id: taxon.iconic_taxon_id,
            ancestor_ids: Array.isArray(taxon.ancestor_ids) ? taxon.ancestor_ids : [],
            square_url: _getBestImageUrl(taxon),
            small_url: taxon.small_url || _getBestImageUrl(taxon),
            medium_url: taxon.medium_url || _getBestImageUrl(taxon),
            thumbnail: taxon.thumbnail || _getBestImageUrl(taxon),
            wikipedia_url: taxon.wikipedia_url || '',
            description: taxon.description || '',
            descriptionUpdatedAt: taxon.description ? Date.now() : null,
            updatedAt: Date.now(),
          });
        }
      });
      if (onProgress) onProgress(Math.min(i + batchSize, taxonList.length));
    }
  } catch (error) {
    console.error('Failed to seed taxa:', error);
    throw error;
  }
}

/**
 * Upsert (insert or merge) a single taxon into the encyclopedia.
 * Always merges best images, ancestors, and description.
 * @param {Object} taxonData - Full taxon from iNaturalist API
 * @param {Object} opts - { skipEnrichment: bool }
 */
export async function upsertTaxon(taxonData, opts = {}) {
  const { skipEnrichment = false } = opts;
  if (!taxonData?.id) return null;

  const taxonId = taxonData.id;
  let shouldQueueEnrichment = false;

  try {
    const result = await db.transaction('rw', taxaTable, statsTable, async () => {
      const existing = await taxaTable.get(taxonId);

      // Merge ancestors: keep existing if better populated
      const ancestorIds = Array.isArray(taxonData.ancestor_ids)
        ? taxonData.ancestor_ids
        : (existing?.ancestor_ids || []);

      // Merge images: prefer new over existing if new has better data
      const imageUrl = _getBestImageUrl(taxonData) || existing?.square_url || PLACEHOLDER_IMAGE_URL;

      // Merge description: keep cached if available
      const description = taxonData.description || existing?.description || '';
      const descriptionUpdatedAt = taxonData.description
        ? Date.now()
        : (existing?.descriptionUpdatedAt || null);

      const merged = {
        id: taxonId,
        name: taxonData.name || existing?.name,
        preferred_common_name: taxonData.preferred_common_name || existing?.preferred_common_name || taxonData.name,
        rank: taxonData.rank || existing?.rank || 'unknown',
        iconic_taxon_id: taxonData.iconic_taxon_id ?? existing?.iconic_taxon_id,
        ancestor_ids: ancestorIds,
        square_url: imageUrl,
        small_url: taxonData.small_url || existing?.small_url || imageUrl,
        medium_url: taxonData.medium_url || existing?.medium_url || imageUrl,
        thumbnail: taxonData.thumbnail || existing?.thumbnail || imageUrl,
        wikipedia_url: taxonData.wikipedia_url || existing?.wikipedia_url || '',
        description,
        descriptionUpdatedAt,
        updatedAt: Date.now(),
      };

      await taxaTable.put(merged);

      // If ancestors are missing and we haven't skipped enrichment, queue it
      if (!skipEnrichment && (!ancestorIds || ancestorIds.length === 0)) {
        shouldQueueEnrichment = true;
      }

      return merged;
    });

    if (shouldQueueEnrichment) {
      queueTaxonForEnrichment(taxonId);
    }

    return result;
  } catch (error) {
    console.error(`Failed to upsert taxon ${taxonId}:`, error);
    throw error;
  }
}

/**
 * Record a player encounter with a taxon.
 * Updates stats and enriches taxon data. Emits events (levelUp, firstSeen).
 * @param {Object} taxonData - Full taxon from iNaturalist API
 * @param {Object} encounter - { isCorrect, thumbnail, occurredAt }
 * @returns {Promise<{levelUp, firstSeen, oldLevel, newLevel, stats}>}
 */
export async function recordEncounter(taxonData, encounter = {}) {
  const { isCorrect = false, thumbnail = null, occurredAt = new Date() } = encounter;
  if (!taxonData?.id) throw new Error('Invalid taxonData in recordEncounter');

  const taxonId = taxonData.id;
  const occurredTime = occurredAt instanceof Date ? occurredAt.toISOString() : occurredAt;

  const result = {
    levelUp: false,
    firstSeen: false,
    oldLevel: MASTERY_LEVELS.NONE,
    newLevel: MASTERY_LEVELS.NONE,
    stats: null,
  };

  try {
    // Always upsert taxon first (enriches encyclopedia)
    await upsertTaxon(taxonData, { skipEnrichment: false });

    // Update stats in transaction
    await db.transaction('rw', statsTable, async () => {
      const existing = await statsTable.get(taxonId);
      result.firstSeen = !existing;
      result.oldLevel = existing?.masteryLevel || MASTERY_LEVELS.NONE;

      const newStats = {
        id: taxonId,
        iconic_taxon_id: taxonData.iconic_taxon_id,
        seenCount: (existing?.seenCount || 0) + 1,
        correctCount: isCorrect ? (existing?.correctCount || 0) + 1 : (existing?.correctCount || 0),
        streak: isCorrect ? (existing?.streak || 0) + 1 : 0,
        firstSeenAt: existing?.firstSeenAt || occurredTime,
        lastSeenAt: occurredTime,
        accuracy: 0, // Will be calculated below
        masteryLevel: MASTERY_LEVELS.NONE, // Will be calculated below
      };

      // Calculate accuracy and mastery
      newStats.accuracy = newStats.seenCount > 0 ? newStats.correctCount / newStats.seenCount : 0;
      newStats.masteryLevel = _calculateMasteryLevel(newStats.correctCount, newStats.seenCount);

      // Detect level up
      if (newStats.masteryLevel > result.oldLevel) {
        result.levelUp = true;
      }

      result.newLevel = newStats.masteryLevel;
      result.stats = newStats;

      await statsTable.put(newStats);
    });

    // Broadcast update
    _broadcastUpdate();

    return result;
  } catch (error) {
    console.error(`Failed to record encounter for taxon ${taxonId}:`, error);
    throw error;
  }
}

/**
 * Get collection summary per iconic taxon.
 * @returns {Promise<{iconic_taxon_id: {seenCount, masteredCount, progressPercent, masteryBreakdown}}>}
 */
export async function getIconicSummary() {
  try {
    const allStats = await statsTable.toArray();
    const summary = {};

    // Initialize all iconic taxa
    const allTaxa = await taxaTable.toArray();
    const iconicIds = new Set(allTaxa.map(t => t.iconic_taxon_id).filter(Boolean));

    for (const iconicId of iconicIds) {
      summary[iconicId] = {
        iconicTaxonId: iconicId,
        seenCount: 0,
        masteredCount: 0,
        progressPercent: 0,
        masteryBreakdown: {
          [MASTERY_LEVELS.NONE]: 0,
          [MASTERY_LEVELS.BRONZE]: 0,
          [MASTERY_LEVELS.SILVER]: 0,
          [MASTERY_LEVELS.GOLD]: 0,
          [MASTERY_LEVELS.DIAMOND]: 0,
        },
      };
    }

    // Count stats per iconic
    for (const stat of allStats) {
      const taxon = allTaxa.find(t => t.id === stat.id);
      if (!taxon) continue;

      const iconicId = taxon.iconic_taxon_id;
      if (!iconicId || !summary[iconicId]) continue;

      summary[iconicId].seenCount += 1;
      if (stat.masteryLevel > MASTERY_LEVELS.NONE) {
        summary[iconicId].masteredCount += 1;
      }
      summary[iconicId].masteryBreakdown[stat.masteryLevel] =
        (summary[iconicId].masteryBreakdown[stat.masteryLevel] || 0) + 1;
    }

    // Calculate progress percent
    for (const iconicId in summary) {
      const totalInIconic = allTaxa.filter(t => t.iconic_taxon_id === parseInt(iconicId)).length;
      if (totalInIconic > 0) {
        summary[iconicId].progressPercent = Math.round((summary[iconicId].seenCount / totalInIconic) * 100);
      }
    }

    return summary;
  } catch (error) {
    console.error('Failed to get iconic summary:', error);
    throw error;
  }
}

/**
 * Get paginated species for a given iconic taxon.
 * @param {Object} params - { iconicId, offset, limit, sort }
 *   sort: 'mastery' (default), 'recent', 'alpha'
 * @returns {Promise<{species: Array, total: number}>}
 */
export async function getSpeciesPage(params = {}) {
  const { iconicId, offset = 0, limit = 50, sort = 'mastery' } = params;
  if (!iconicId) throw new Error('iconicId required for getSpeciesPage');

  try {
    return await db.transaction('r', taxaTable, statsTable, async () => {
      // Get all taxa for this iconic taxon
      let allTaxa = await taxaTable.where('iconic_taxon_id').equals(iconicId).toArray();

      // Build array of { taxon, stats }
      const withStats = await Promise.all(
        allTaxa.map(async (taxon) => ({
          taxon,
          stats: await statsTable.get(taxon.id),
        }))
      );

      // Filter: only include seen species
      const seen = withStats.filter(item => item.stats);

      // Sort
      if (sort === 'mastery') {
        seen.sort((a, b) => {
          const levelDiff = (b.stats?.masteryLevel || 0) - (a.stats?.masteryLevel || 0);
          if (levelDiff !== 0) return levelDiff;
          return (b.stats?.lastSeenAt || 0) > (a.stats?.lastSeenAt || 0) ? -1 : 1;
        });
      } else if (sort === 'recent') {
        seen.sort((a, b) => (b.stats?.lastSeenAt || 0) - (a.stats?.lastSeenAt || 0));
      } else if (sort === 'alpha') {
        seen.sort((a, b) => (a.taxon?.name || '').localeCompare(b.taxon?.name || ''));
      }

      const total = seen.length;
      const paginated = seen.slice(offset, offset + limit);

      return { species: paginated, total };
    });
  } catch (error) {
    console.error('Failed to get species page:', error);
    throw error;
  }
}

/**
 * Get full detail for a single species (taxon + stats + ancestors).
 * @param {number} taxonId
 * @returns {Promise<{taxon, stats, ancestors}>}
 */
export async function getSpeciesDetail(taxonId) {
  if (!taxonId) return null;

  try {
    return await db.transaction('r', taxaTable, statsTable, async () => {
      const [taxon, stats] = await Promise.all([
        taxaTable.get(taxonId),
        statsTable.get(taxonId),
      ]);

      if (!taxon) return null;

      // Fetch ancestors if available
      let ancestors = [];
      if (Array.isArray(taxon.ancestor_ids) && taxon.ancestor_ids.length > 0) {
        ancestors = await taxaTable.bulkGet(taxon.ancestor_ids);
        ancestors = ancestors.filter(Boolean); // Remove nulls
      }

      return {
        taxon,
        stats: stats || null,
        ancestors,
      };
    });
  } catch (error) {
    console.error(`Failed to get species detail for ${taxonId}:`, error);
    throw error;
  }
}

/**
 * Update taxon description (cached from Wikipedia/iNat).
 * @param {number} taxonId
 * @param {string} description
 */
export async function updateTaxonDescription(taxonId, description) {
  if (!taxonId || !description) return;
  try {
    await taxaTable.update(taxonId, {
      description,
      descriptionUpdatedAt: Date.now(),
    });
    _broadcastUpdate();
  } catch (error) {
    console.error(`Failed to update description for taxon ${taxonId}:`, error);
  }
}

/**
 * Listen for collection updates from other tabs.
 * @param {Function} callback - Called when update detected
 * @returns {Function} Unsubscribe function
 */
export function onCollectionUpdated(callback) {
  if (typeof BroadcastChannel === 'undefined') {
    return () => {};
  }

  try {
    const channel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
    const handler = (event) => {
      if (event?.data?.type === 'COLLECTION_UPDATED') {
        callback();
      }
    };
    channel.addEventListener('message', handler);
    return () => {
      channel.removeEventListener('message', handler);
      channel.close();
    };
  } catch (err) {
    console.warn('Failed to setup BroadcastChannel listener:', err);
    return () => {};
  }
}

// ============== EXPORTS ==============

const CollectionService = {
  MASTERY_LEVELS,
  MASTERY_NAMES,
  MASTERY_THRESHOLDS,
  seedTaxa,
  upsertTaxon,
  recordEncounter,
  getIconicSummary,
  getSpeciesPage,
  getSpeciesDetail,
  updateTaxonDescription,
  onCollectionUpdated,
};

export default CollectionService;
