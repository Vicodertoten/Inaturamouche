import db, { taxa as taxaTable, stats as statsTable } from './db.js';
import Dexie from 'dexie';
import { queueTaxonForEnrichment } from './TaxonomyService.js';
import { getRarityTier } from '../utils/rarityUtils';

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

// --------- XP-based mastery system ---------
// Replace the old ratio-based system with a simple XP system.
export const XP_GAINS = Object.freeze({
  CORRECT: 10,
  WRONG: -5,
});

export const MASTERY_XP_THRESHOLDS = Object.freeze({
  [MASTERY_LEVELS.BRONZE]: 10,
  [MASTERY_LEVELS.SILVER]: 50,
  [MASTERY_LEVELS.GOLD]: 120,
  [MASTERY_LEVELS.DIAMOND]: 300,
});

const PLACEHOLDER_IMAGE_URL = '/placeholder.svg';
const BROADCAST_CHANNEL_NAME = 'COLLECTION_UPDATED';

// ============== INTERNAL HELPERS ==============

/**
 * Calculate mastery level based on accumulated XP.
 * Uses the XP thresholds defined above to map xp -> mastery level.
 * @param {number} xp
 * @returns {number} MASTERY_LEVELS
 */
function _calculateMasteryLevel(xp = 0) {
  if (!xp || xp <= 0) return MASTERY_LEVELS.NONE;
  if (xp >= MASTERY_XP_THRESHOLDS[MASTERY_LEVELS.DIAMOND]) return MASTERY_LEVELS.DIAMOND;
  if (xp >= MASTERY_XP_THRESHOLDS[MASTERY_LEVELS.GOLD]) return MASTERY_LEVELS.GOLD;
  if (xp >= MASTERY_XP_THRESHOLDS[MASTERY_LEVELS.SILVER]) return MASTERY_LEVELS.SILVER;
  if (xp >= MASTERY_XP_THRESHOLDS[MASTERY_LEVELS.BRONZE]) return MASTERY_LEVELS.BRONZE;
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
          
          // Extract ancestor IDs from ancestors array or use ancestor_ids
          let ancestorIds = [];
          if (Array.isArray(taxon.ancestors)) {
            ancestorIds = taxon.ancestors.map(a => a.id).filter(Boolean);
          } else if (Array.isArray(taxon.ancestor_ids)) {
            ancestorIds = taxon.ancestor_ids;
          }
          
          const observationsCount = Number.isFinite(Number(taxon.observations_count))
            ? Number(taxon.observations_count)
            : null;
          await taxaTable.put({
            id: taxon.id,
            name: taxon.name,
            preferred_common_name: taxon.preferred_common_name || taxon.name,
            rank: taxon.rank || 'unknown',
            iconic_taxon_id: taxon.iconic_taxon_id,
            ancestor_ids: ancestorIds,
            square_url: _getBestImageUrl(taxon),
            small_url: taxon.small_url || _getBestImageUrl(taxon),
            medium_url: taxon.medium_url || _getBestImageUrl(taxon),
            thumbnail: taxon.thumbnail || _getBestImageUrl(taxon),
            wikipedia_url: taxon.wikipedia_url || '',
            observations_count: observationsCount,
            rarity_tier: getRarityTier(observationsCount),
            conservation_status: taxon.conservation_status || null,
            description: taxon.description || '',
            descriptionUpdatedAt: taxon.description ? Date.now() : null,
            updatedAt: Date.now(),
          });
          
          // Also seed the ancestors if they exist. Use a Set to avoid duplicate writes
          if (Array.isArray(taxon.ancestors)) {
            const seededAncestors = new Set();
            for (const ancestor of taxon.ancestors) {
              if (!ancestor?.id) continue;
              if (seededAncestors.has(ancestor.id)) continue; // already handled in this batch

              const existing = await taxaTable.get(ancestor.id);
              if (!existing) {
                // Only insert if not already in DB
                await taxaTable.put({
                  id: ancestor.id,
                  name: ancestor.name,
                  preferred_common_name: ancestor.preferred_common_name || ancestor.name,
                  rank: ancestor.rank || 'unknown',
                  iconic_taxon_id: ancestor.iconic_taxon_id || null,
                  ancestor_ids: [],
                  square_url: _getBestImageUrl(ancestor),
                  small_url: ancestor.small_url || '',
                  medium_url: ancestor.medium_url || '',
                  thumbnail: ancestor.thumbnail || '',
                  wikipedia_url: ancestor.wikipedia_url || '',
                  description: ancestor.description || '',
                  descriptionUpdatedAt: null,
                  updatedAt: Date.now(),
                });
              }
              seededAncestors.add(ancestor.id);
            }
          }
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

      const observationsCount = Number.isFinite(Number(taxonData.observations_count))
        ? Number(taxonData.observations_count)
        : existing?.observations_count ?? null;
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
        observations_count: observationsCount,
        rarity_tier: getRarityTier(observationsCount) || existing?.rarity_tier || null,
        conservation_status: taxonData.conservation_status || existing?.conservation_status || null,
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
  const { isCorrect = false, occurredAt = new Date() } = encounter;
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

      // Compute new XP (bounded to min 0)
      const prevXp = existing?.xp || 0;
      const xpDelta = isCorrect ? XP_GAINS.CORRECT : XP_GAINS.WRONG;
      const newXp = Math.max(0, prevXp + xpDelta);

      const newStats = {
        id: taxonId,
        iconic_taxon_id: taxonData.iconic_taxon_id,
        seenCount: (existing?.seenCount || 0) + 1,
        correctCount: isCorrect ? (existing?.correctCount || 0) + 1 : (existing?.correctCount || 0),
        streak: isCorrect ? (existing?.streak || 0) + 1 : 0,
        xp: newXp,
        firstSeenAt: existing?.firstSeenAt || occurredTime,
        lastSeenAt: occurredTime,
        // accuracy (legacy) kept for analytics but not used for mastery calculation
        accuracy: 0,
        masteryLevel: MASTERY_LEVELS.NONE, // Will be calculated below
        
        // Spaced Repetition fields
        nextReviewDate: calculateNextReviewDate(existing, isCorrect, occurredTime),
        reviewInterval: calculateReviewInterval(existing, isCorrect),
        easeFactor: calculateEaseFactor(existing, isCorrect),
      };

      // Legacy accuracy (keep for analytics)
      newStats.accuracy = newStats.seenCount > 0 ? newStats.correctCount / newStats.seenCount : 0;

      // Calculate mastery based on XP
      newStats.masteryLevel = _calculateMasteryLevel(newStats.xp);

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
 * Supports: iconicId, offset, limit, sort ('mastery'|'recent'|'alpha'), searchQuery (string), filterStatus ('all'|'seen'|'mastered'|'to_learn')
 * Returns minimally populated objects: { taxon, stats }
 */
export async function getSpeciesPage(params = {}) {
  const {
    iconicId,
    offset = 0,
    limit = 50,
    sort = 'mastery',
    searchQuery = '',
    filterStatus = 'all',
    filterRarity = 'all',
  } = params;

  if (!iconicId) throw new Error('iconicId required for getSpeciesPage');

  const defaultStatsFor = (taxonId) => ({
    id: taxonId,
    masteryLevel: MASTERY_LEVELS.NONE,
    xp: 0,
    seenCount: 0,
    correctCount: 0,
    streak: 0,
    firstSeenAt: null,
    lastSeenAt: null,
  });

  const normalizedRarity = filterRarity && filterRarity !== 'all' ? String(filterRarity) : null;
  const matchesRarity = (taxon) =>
    !normalizedRarity || taxon?.rarity_tier === normalizedRarity;
  const matchesStatus = (stats) => {
    if (filterStatus === 'seen') return Boolean(stats);
    if (filterStatus === 'mastered') return Boolean(stats?.masteryLevel > MASTERY_LEVELS.NONE);
    if (filterStatus === 'to_learn') return !(stats?.masteryLevel > MASTERY_LEVELS.NONE);
    return true;
  };
  const sortSpecies = (list) => {
    const sorted = list.slice();
    if (sort === 'mastery') {
      sorted.sort((a, b) => (b.stats?.masteryLevel || 0) - (a.stats?.masteryLevel || 0));
    } else if (sort === 'recent') {
      sorted.sort((a, b) => (b.stats?.lastSeenAt || '').localeCompare(a.stats?.lastSeenAt || ''));
    } else if (sort === 'alpha') {
      sorted.sort((a, b) => (a.taxon?.name || '').localeCompare(b.taxon?.name || ''));
    } else if (sort === 'rarity') {
      sorted.sort((a, b) => {
        const aCount = Number.isFinite(a.taxon?.observations_count) ? a.taxon.observations_count : Number.POSITIVE_INFINITY;
        const bCount = Number.isFinite(b.taxon?.observations_count) ? b.taxon.observations_count : Number.POSITIVE_INFINITY;
        return aCount - bCount;
      });
    } else if (sort === 'rarity_common') {
      sorted.sort((a, b) => {
        const aCount = Number.isFinite(a.taxon?.observations_count) ? a.taxon.observations_count : Number.NEGATIVE_INFINITY;
        const bCount = Number.isFinite(b.taxon?.observations_count) ? b.taxon.observations_count : Number.NEGATIVE_INFINITY;
        return bCount - aCount;
      });
    }
    return sorted;
  };

  try {
    return await db.transaction('r', taxaTable, statsTable, async () => {
      // Helper: determine which stats entries match the iconicId and optional filters

      // -------------- SEARCH PATH --------------
      if (searchQuery && searchQuery.trim().length > 0) {
        const q = searchQuery.trim();
        // Base collection: taxa whose name starts with query (case-insensitive) and belong to iconicId
        let base = taxaTable
          .where('name')
          .startsWithIgnoreCase(q)
          .and(t => t.iconic_taxon_id === iconicId && matchesRarity(t));

        const total = await base.count();

        // Fill page by pulling chunks and applying filterStatus in-memory until we have enough
        let collected = [];
        let cursor = offset;
        const CHUNK = Math.max(limit * 3, 50);

        while (collected.length < limit) {
          const chunk = await base.offset(cursor).limit(CHUNK).toArray();
          if (!chunk.length) break;

          const ids = chunk.map(t => t.id);
          const statsArr = await statsTable.bulkGet(ids);

          for (let i = 0; i < chunk.length && collected.length < limit; i++) {
            const taxon = chunk[i];
            const stat = statsArr[i] || null;

            // Apply filterStatus
            if (!matchesStatus(stat)) continue;

            collected.push({ taxon, stats: stat || defaultStatsFor(taxon.id) });
          }

          cursor += chunk.length;
          if (chunk.length < CHUNK) break; // no more data
        }

        return { species: sortSpecies(collected), total };
      }

      const shouldUseRarityIndex = Boolean(normalizedRarity);
      const requiresRaritySort = sort === 'rarity' || sort === 'rarity_common';

      if (shouldUseRarityIndex || requiresRaritySort) {
        const taxaBase = shouldUseRarityIndex
          ? await taxaTable.where('rarity_tier').equals(normalizedRarity).and(t => t.iconic_taxon_id === iconicId).toArray()
          : await taxaTable.where('iconic_taxon_id').equals(iconicId).toArray();
        const statsForTaxa = await statsTable.bulkGet(taxaBase.map(t => t.id));
        let combined = taxaBase.map((taxon, i) => ({ taxon, stats: statsForTaxa[i] || defaultStatsFor(taxon.id) }));
        combined = combined.filter((entry) => matchesStatus(entry.stats));

        const sorted = sortSpecies(combined);
        const total = sorted.length;
        const species = sorted.slice(offset, offset + limit);
        return { species, total };
      }

      // -------------- NO SEARCH PATH --------------
      // If we can rely on stats table (seen/mastered/recent/mastery) use indexes
      if (filterStatus === 'seen' || filterStatus === 'mastered' || sort === 'recent' || sort === 'mastery') {
        let statsCollection = null;
        if (sort === 'mastery') {
          // Use composite index to sort by mastery (ascending numeric), reverse to get highest first
          statsCollection = statsTable.where('[iconic_taxon_id+masteryLevel]').between([iconicId, Dexie.minKey], [iconicId, Dexie.maxKey]).reverse();
        } else if (sort === 'recent') {
          // Use composite index on [iconic+lastSeenAt]
          statsCollection = statsTable.where('[iconic_taxon_id+lastSeenAt]').between([iconicId, Dexie.minKey], [iconicId, Dexie.maxKey]).reverse();
        } else {
          // Default to all stats for this iconic
          statsCollection = statsTable.where('iconic_taxon_id').equals(iconicId);
        }

        // If we want only mastered, narrow the range (mastery >= 1)
        if (filterStatus === 'mastered' && sort === 'mastery') {
          statsCollection = statsTable.where('[iconic_taxon_id+masteryLevel]').between([iconicId, 1], [iconicId, Dexie.maxKey]).reverse();
        }

        const totalSeen = await statsCollection.count();

        // For the 'seen'/'mastered' filters the results come entirely from stats table
        if (filterStatus === 'seen' || filterStatus === 'mastered') {
          const statsPage = await statsCollection.offset(offset).limit(limit).toArray();
          // Map to taxon objects
          const taxonIds = statsPage.map(s => s.id);
          const taxa = await taxaTable.bulkGet(taxonIds);
            const species = statsPage.map((s, i) => ({ taxon: taxa[i] || null, stats: s })).filter((entry) => matchesRarity(entry.taxon));
            return { species, total: totalSeen };
          }

        // For 'all' with sort mastery/recent we need to include unseen taxa after seen ones.
        if (filterStatus === 'all' && (sort === 'mastery' || sort === 'recent')) {
          // First, grab seen stats in page window
          let seenPage = await statsCollection.offset(offset).limit(limit).toArray();
          // If we've got enough, map and return
          if (seenPage.length === limit) {
            const taxonIds = seenPage.map(s => s.id);
            const taxa = await taxaTable.bulkGet(taxonIds);
            const filteredSpecies = seenPage.map((s, i) => ({ taxon: taxa[i] || null, stats: s })).filter((entry) => matchesRarity(entry.taxon));
            return { species: filteredSpecies, total: await taxaTable.where('iconic_taxon_id').equals(iconicId).count() };
          }

          // If not enough seen to fill the page, we need to append unseen taxa
          const seenCount = await statsTable.where('iconic_taxon_id').equals(iconicId).count();
          const remaining = limit - seenPage.length;

          // Fetch unseen taxa by scanning taxa table, skipping taxa that have stats
          const unseen = [];
          let cursor = Math.max(0, offset - seenCount);
          const CHUNK = Math.max(100, remaining * 5);

          while (unseen.length < remaining) {
            const chunk = await taxaTable.where('iconic_taxon_id').equals(iconicId).offset(cursor).limit(CHUNK).toArray();
            if (!chunk.length) break;
            const ids = chunk.map(t => t.id);
            const statsArr = await statsTable.bulkGet(ids);
            for (let i = 0; i < chunk.length && unseen.length < remaining; i++) {
              if (statsArr[i]) continue; // skip seen
              unseen.push({ taxon: chunk[i], stats: defaultStatsFor(chunk[i].id) });
            }
            cursor += chunk.length;
            if (chunk.length < CHUNK) break;
          }

          const taxonIds = seenPage.map(s => s.id);
          const taxa = await taxaTable.bulkGet(taxonIds);
          const mappedSeen = seenPage.map((s, i) => ({ taxon: taxa[i] || null, stats: s })).filter((entry) => matchesRarity(entry.taxon));

          const combined = [...mappedSeen, ...unseen].slice(0, limit);
          const total = await taxaTable.where('iconic_taxon_id').equals(iconicId).count();
          return { species: combined, total };
        }
      }

      // Default: alpha sort or fallback - use taxa table and attach stats lazily
      const base = taxaTable.where('iconic_taxon_id').equals(iconicId);
      const total = await base.count();
      const taxaPage = await base.offset(offset).limit(limit).toArray();
      const statsForPage = await statsTable.bulkGet(taxaPage.map(t => t.id));
      const species = taxaPage
        .map((taxon, i) => ({ taxon, stats: statsForPage[i] || defaultStatsFor(taxon.id) }))
        .filter((entry) => matchesRarity(entry.taxon));
      if (sort === 'alpha') {
        species.sort((a, b) => (a.taxon?.name || '').localeCompare(b.taxon?.name || ''));
      }

      return { species, total };
    });
  } catch (error) {
    console.error('❌ Failed to get species page:', error);
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

      // Fetch ancestors from the database
      let ancestors = [];
      if (Array.isArray(taxon.ancestor_ids) && taxon.ancestor_ids.length > 0) {
        const ancestorsFromDb = await taxaTable.bulkGet(taxon.ancestor_ids);
        ancestors = ancestorsFromDb.filter(Boolean); // Remove nulls
      }

      console.log(`📊 getSpeciesDetail for ${taxonId}:`, {
        taxonName: taxon.name,
        ancestorCount: ancestors.length,
        ancestors: ancestors.map(a => ({ id: a.id, name: a.name, rank: a.rank })),
      });

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

/**
 * Find similar species (same genus or family) that could be confused with the given taxon.
 * @param {number} taxonId
 * @param {Array} ancestors - The ancestor chain from getSpeciesDetail
 * @returns {Promise<Array>} Similar species
 */
export async function getSimilarSpecies(taxonId, ancestors = []) {
  try {
    console.log(`🔍 getSimilarSpecies called for taxon ${taxonId}`);
    console.log(`📋 Ancestors received:`, ancestors);
    
    let genusId = null;
    
    // Try to get genus from ancestors array
    if (ancestors && ancestors.length > 0) {
      const genusAncestor = ancestors.find(a => a.rank === 'genus');
      if (genusAncestor) {
        genusId = genusAncestor.id;
        console.log(`✅ Found genus in ancestors: ${genusAncestor.name} (${genusId})`);
      }
    }
    
    // If no genus found, fetch from iNaturalist API directly
    if (!genusId) {
      console.log(`⚠️ No genus in ancestors, fetching from iNaturalist API...`);
      try {
        const taxonResponse = await fetch(`https://api.inaturalist.org/v1/taxa/${taxonId}`);
        if (taxonResponse.ok) {
          const taxonData = await taxonResponse.json();
          const taxonResult = taxonData.results?.[0];
          if (taxonResult?.ancestors) {
            const genusFromApi = taxonResult.ancestors.find(a => a.rank === 'genus');
            if (genusFromApi) {
              genusId = genusFromApi.id;
              console.log(`✅ Found genus from API: ${genusFromApi.name} (${genusId})`);
            }
          }
        }
      } catch (err) {
        console.error('❌ Failed to fetch taxon from API:', err);
      }
    }
    
    if (!genusId) {
      console.warn('⚠️ Could not find genus for this species');
      return [];
    }

    // Fetch species from the same genus
    const url = `https://api.inaturalist.org/v1/taxa?taxon_id=${genusId}&rank=species&per_page=10&order=observations_count&order_by=desc`;
    console.log(`📡 API URL:`, url);
    
    const response = await fetch(url, { headers: { 'Accept': 'application/json' } });

    if (!response.ok) {
      console.warn(`⚠️ API error: ${response.status}`);
      return [];
    }

    const data = await response.json();
    console.log(`📦 API Response:`, data);
    
    const similar = (data.results || [])
      .filter(t => t.id !== taxonId) // Exclude the current taxon
      .slice(0, 5); // Top 5 similar

    console.log(`✅ Found ${similar.length} similar species:`, similar.map(s => ({ id: s.id, name: s.name })));
    return similar;
  } catch (error) {
    console.error('❌ Failed to get similar species:', error);
    return [];
  }
}

// ============== SPACED REPETITION SYSTEM ==============

/**
 * Calculate the next review date based on Spaced Repetition algorithm.
 * First encounter → review in 1 day
 * Correct answer → double interval (max 90 days)
 * Wrong answer → reset to 1 day
 * @param {Object} existing - Existing stats object
 * @param {boolean} isCorrect - Whether the answer was correct
 * @param {string} now - Current timestamp (ISO string)
 * @returns {string} Next review date (ISO string)
 */
function calculateNextReviewDate(existing, isCorrect, now) {
  const currentDate = new Date(now);
  
  if (!existing) {
    // First encounter → review in 1 day
    const nextDate = new Date(currentDate);
    nextDate.setDate(nextDate.getDate() + 1);
    return nextDate.toISOString();
  }
  
  const currentInterval = existing.reviewInterval || 1;
  let newInterval;
  
  if (isCorrect) {
    // Correct answer → double interval (max 90 days)
    newInterval = Math.min(currentInterval * 2, 90);
  } else {
    // Wrong answer → reset to 1 day
    newInterval = 1;
  }
  
  const nextDate = new Date(currentDate);
  nextDate.setDate(nextDate.getDate() + newInterval);
  return nextDate.toISOString();
}

/**
 * Calculate the review interval in days.
 * @param {Object} existing - Existing stats object
 * @param {boolean} isCorrect - Whether the answer was correct
 * @returns {number} Review interval in days
 */
function calculateReviewInterval(existing, isCorrect) {
  if (!existing) return 1;
  
  const current = existing.reviewInterval || 1;
  
  if (isCorrect) {
    return Math.min(current * 2, 90);
  } else {
    return 1;
  }
}

/**
 * Calculate ease factor (inspired by Anki algorithm).
 * This represents subjective difficulty.
 * @param {Object} existing - Existing stats object
 * @param {boolean} isCorrect - Whether the answer was correct
 * @returns {number} Ease factor (1.3 to 3.0)
 */
function calculateEaseFactor(existing, isCorrect) {
  const currentEase = existing?.easeFactor || 2.5;
  
  if (isCorrect) {
    // Increase ease slightly (max 3.0)
    return Math.min(currentEase + 0.1, 3.0);
  } else {
    // Decrease ease (min 1.3)
    return Math.max(currentEase - 0.2, 1.3);
  }
}

/**
 * Get species that are due for review.
 * Filters by nextReviewDate <= now and sorts by priority:
 * 1. Species with short review intervals (difficult ones)
 * 2. Species not seen recently (by lastSeenAt)
 * @param {number} limit - Maximum number of species to return (default: 10)
 * @returns {Promise<Array<{stat, taxon}>>} Species due for review
 */
export async function getSpeciesDueForReview(limit = 10) {
  try {
    const now = new Date();
    const allStats = await statsTable.toArray();
    
    // Filter species where nextReviewDate <= now
    const dueForReview = allStats.filter(stat => {
      if (!stat.nextReviewDate) return false;
      const reviewDate = new Date(stat.nextReviewDate);
      return reviewDate <= now;
    });
    
    // Sort by priority:
    // 1. Species with short intervals (difficult)
    // 2. Species not seen recently
    dueForReview.sort((a, b) => {
      // Priority to short intervals (difficult species)
      if (a.reviewInterval !== b.reviewInterval) {
        return a.reviewInterval - b.reviewInterval;
      }
      // Then by oldest lastSeenAt
      return new Date(a.lastSeenAt) - new Date(b.lastSeenAt);
    });
    
    // Limit the number
    const selected = dueForReview.slice(0, limit);
    
    // Enrich with taxon data
    const enriched = await Promise.all(
      selected.map(async (stat) => {
        const taxon = await taxaTable.get(stat.id);
        return { stat, taxon };
      })
    );
    
    // Filter out missing taxa
    return enriched.filter(item => item.taxon);
  } catch (error) {
    console.error('Failed to get species due for review:', error);
    return [];
  }
}

/**
 * Get review system statistics.
 * Returns counts for today, tomorrow, and total in review system.
 * @returns {Promise<{dueToday, dueTomorrow, totalInReviewSystem}>}
 */
export async function getReviewStats() {
  try {
    const now = new Date();
    const allStats = await statsTable.toArray();
    
    const dueToday = allStats.filter(stat => {
      if (!stat.nextReviewDate) return false;
      const reviewDate = new Date(stat.nextReviewDate);
      return reviewDate <= now;
    }).length;
    
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(23, 59, 59, 999); // End of tomorrow
    
    const dueTomorrow = allStats.filter(stat => {
      if (!stat.nextReviewDate) return false;
      const reviewDate = new Date(stat.nextReviewDate);
      return reviewDate > now && reviewDate <= tomorrow;
    }).length;
    
    const totalInReviewSystem = allStats.filter(stat => stat.nextReviewDate).length;
    
    return {
      dueToday,
      dueTomorrow,
      totalInReviewSystem,
    };
  } catch (error) {
    console.error('Failed to get review stats:', error);
    return {
      dueToday: 0,
      dueTomorrow: 0,
      totalInReviewSystem: 0,
    };
  }
}

// ============== EXPORTS ==============

const CollectionService = {
  MASTERY_LEVELS,
  MASTERY_NAMES,
  // Expose XP constants for external use
  XP_GAINS,
  MASTERY_XP_THRESHOLDS,
  seedTaxa,
  upsertTaxon,
  recordEncounter,
  getIconicSummary,
  getSpeciesPage,
  getSpeciesDetail,
  updateTaxonDescription,
  getSimilarSpecies,
  onCollectionUpdated,
};

export default CollectionService;
