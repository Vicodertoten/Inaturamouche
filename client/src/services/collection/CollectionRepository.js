// client/src/services/collection/CollectionRepository.js
// CRUD operations for the taxa/stats IndexedDB tables.

import db, { taxa as taxaTable, stats as statsTable } from '../db.js';
import { queueTaxonForEnrichment } from '../TaxonomyService.js';
import { getRarityTier, normalizeObservationsCount } from '../../utils/rarityUtils';
import {
  MASTERY_LEVELS,
  XP_GAINS,
  calculateMasteryLevel,
} from './MasteryEngine.js';
import {
  calculateNextReviewDate,
  calculateReviewInterval,
  calculateEaseFactor,
} from './ReviewScheduler.js';

// ============== INTERNAL HELPERS ==============

const PLACEHOLDER_IMAGE_URL = '/placeholder.svg';
const BROADCAST_CHANNEL_NAME = 'COLLECTION_UPDATED';
const COLLECTION_TAXON_RANK = 'species';

const isCollectionSpeciesTaxon = (taxon) =>
  String(taxon?.rank || '').toLowerCase() === COLLECTION_TAXON_RANK;

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
 * Extract best image URL from taxon data.
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

// ============== CRUD ==============

/**
 * Seed taxa into the database (encyclopedia preload).
 * @param {Array<Object>} taxonList
 * @param {Object} opts - { onProgress }
 */
export async function seedTaxa(taxonList, opts = {}) {
  const { onProgress } = opts;
  if (!Array.isArray(taxonList) || taxonList.length === 0) return;

  try {
    const batchSize = 100;
    for (let i = 0; i < taxonList.length; i += batchSize) {
      const batch = taxonList.slice(i, i + batchSize);
      await db.transaction('rw', taxaTable, async () => {
        for (const taxon of batch) {
          if (!taxon?.id) continue;

          let ancestorIds = [];
          if (Array.isArray(taxon.ancestors)) {
            ancestorIds = taxon.ancestors.map((a) => a.id).filter(Boolean);
          } else if (Array.isArray(taxon.ancestor_ids)) {
            ancestorIds = taxon.ancestor_ids;
          }

          const observationsCount = normalizeObservationsCount(taxon?.observations_count);
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

          if (Array.isArray(taxon.ancestors)) {
            const seededAncestors = new Set();
            for (const ancestor of taxon.ancestors) {
              if (!ancestor?.id || seededAncestors.has(ancestor.id)) continue;
              const existing = await taxaTable.get(ancestor.id);
              if (!existing) {
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
 * Upsert a single taxon into the encyclopedia.
 * @param {Object} taxonData
 * @param {Object} opts - { skipEnrichment }
 */
export async function upsertTaxon(taxonData, opts = {}) {
  const { skipEnrichment = false } = opts;
  if (!taxonData?.id) return null;

  const taxonId = taxonData.id;
  let shouldQueueEnrichment = false;

  try {
    const result = await db.transaction('rw', taxaTable, statsTable, async () => {
      const existing = await taxaTable.get(taxonId);

      const ancestorIds = Array.isArray(taxonData.ancestor_ids)
        ? taxonData.ancestor_ids
        : existing?.ancestor_ids || [];

      const imageUrl = _getBestImageUrl(taxonData) || existing?.square_url || PLACEHOLDER_IMAGE_URL;

      const description = taxonData.description || existing?.description || '';
      const descriptionUpdatedAt = taxonData.description
        ? Date.now()
        : existing?.descriptionUpdatedAt || null;

      const incomingObservationsCount = normalizeObservationsCount(taxonData?.observations_count);
      const existingObservationsCount = normalizeObservationsCount(existing?.observations_count);
      const observationsCount = incomingObservationsCount ?? existingObservationsCount ?? null;
      const incomingRank =
        typeof taxonData?.rank === 'string' ? taxonData.rank.trim().toLowerCase() : '';
      const existingRank =
        typeof existing?.rank === 'string' ? existing.rank.trim().toLowerCase() : '';
      const rank =
        incomingRank ||
        (existingRank && existingRank !== 'unknown'
          ? existingRank
          : COLLECTION_TAXON_RANK);

      const merged = {
        id: taxonId,
        name: taxonData.name || existing?.name,
        preferred_common_name:
          taxonData.preferred_common_name || existing?.preferred_common_name || taxonData.name,
        rank,
        iconic_taxon_id: taxonData.iconic_taxon_id ?? existing?.iconic_taxon_id,
        ancestor_ids: ancestorIds,
        square_url: imageUrl,
        small_url: taxonData.small_url || existing?.small_url || imageUrl,
        medium_url: taxonData.medium_url || existing?.medium_url || imageUrl,
        thumbnail: taxonData.thumbnail || existing?.thumbnail || imageUrl,
        wikipedia_url: taxonData.wikipedia_url || existing?.wikipedia_url || '',
        observations_count: observationsCount,
        rarity_tier: getRarityTier(observationsCount),
        conservation_status:
          taxonData.conservation_status || existing?.conservation_status || null,
        description,
        descriptionUpdatedAt,
        updatedAt: Date.now(),
      };

      await taxaTable.put(merged);

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
 * @param {Object} taxonData
 * @param {Object} encounter - { isCorrect, occurredAt }
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
    await upsertTaxon(taxonData, { skipEnrichment: false });

    await db.transaction('rw', statsTable, async () => {
      const existing = await statsTable.get(taxonId);
      result.firstSeen = !existing;
      result.oldLevel = existing?.masteryLevel || MASTERY_LEVELS.NONE;

      const prevXp = existing?.xp || 0;
      const xpDelta = isCorrect ? XP_GAINS.CORRECT : XP_GAINS.WRONG;
      const newXp = Math.max(0, prevXp + xpDelta);

      const newStats = {
        id: taxonId,
        iconic_taxon_id: taxonData.iconic_taxon_id,
        seenCount: (existing?.seenCount || 0) + 1,
        correctCount: isCorrect
          ? (existing?.correctCount || 0) + 1
          : existing?.correctCount || 0,
        streak: isCorrect ? (existing?.streak || 0) + 1 : 0,
        xp: newXp,
        firstSeenAt: existing?.firstSeenAt || occurredTime,
        lastSeenAt: occurredTime,
        accuracy: 0,
        masteryLevel: MASTERY_LEVELS.NONE,
        nextReviewDate: calculateNextReviewDate(existing, isCorrect, occurredTime),
        reviewInterval: calculateReviewInterval(existing, isCorrect),
        easeFactor: calculateEaseFactor(existing, isCorrect),
      };

      newStats.accuracy =
        newStats.seenCount > 0 ? newStats.correctCount / newStats.seenCount : 0;
      newStats.masteryLevel = calculateMasteryLevel(newStats.xp);

      if (newStats.masteryLevel > result.oldLevel) {
        result.levelUp = true;
      }

      result.newLevel = newStats.masteryLevel;
      result.stats = newStats;

      await statsTable.put(newStats);
    });

    _broadcastUpdate();
    return result;
  } catch (error) {
    console.error(`Failed to record encounter for taxon ${taxonId}:`, error);
    throw error;
  }
}

/**
 * Get collection summary per iconic taxon.
 */
export async function getIconicSummary() {
  try {
    const allStats = await statsTable.toArray();
    const summary = {};
    const allTaxa = (await taxaTable.toArray()).filter(isCollectionSpeciesTaxon);
    const taxonById = new Map(allTaxa.map((taxon) => [taxon.id, taxon]));
    const iconicIds = new Set(allTaxa.map((t) => t.iconic_taxon_id).filter(Boolean));

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

    for (const stat of allStats) {
      const taxon = taxonById.get(stat.id);
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

    for (const iconicId in summary) {
      const totalInIconic = allTaxa.filter(
        (t) => t.iconic_taxon_id === parseInt(iconicId),
      ).length;
      if (totalInIconic > 0) {
        summary[iconicId].progressPercent = Math.round(
          (summary[iconicId].seenCount / totalInIconic) * 100,
        );
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
    language = 'fr',
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

  const normalizedRarity =
    filterRarity && filterRarity !== 'all' ? String(filterRarity) : null;
  const normalizedSearch = searchQuery.trim().toLowerCase();
  const matchesRarity = (taxon) =>
    !normalizedRarity || taxon?.rarity_tier === normalizedRarity;
  const matchesSearch = (taxon) => {
    if (!normalizedSearch) return true;
    const scientific = String(taxon?.name || '').toLowerCase();
    const common = String(taxon?.local_preferred_common_name || taxon?.preferred_common_name || '').toLowerCase();
    return scientific.includes(normalizedSearch) || common.includes(normalizedSearch);
  };
  const matchesStatus = (rawStat) => {
    if (filterStatus === 'seen') return Boolean(rawStat);
    if (filterStatus === 'mastered')
      return Boolean(rawStat?.masteryLevel > MASTERY_LEVELS.NONE);
    if (filterStatus === 'to_learn')
      return !(rawStat?.masteryLevel > MASTERY_LEVELS.NONE);
    return true;
  };
  const sortSpecies = (list) => {
    const sorted = list.slice();
    if (sort === 'mastery') {
      sorted.sort(
        (a, b) => (b.stats?.masteryLevel || 0) - (a.stats?.masteryLevel || 0),
      );
    } else if (sort === 'recent') {
      sorted.sort((a, b) =>
        (b.stats?.lastSeenAt || '').localeCompare(a.stats?.lastSeenAt || ''),
      );
    } else if (sort === 'alpha') {
      sorted.sort((a, b) =>
        (a.taxon?.name || '').localeCompare(b.taxon?.name || ''),
      );
    } else if (sort === 'rarity') {
      sorted.sort((a, b) => {
        const aCount = normalizeObservationsCount(a.taxon?.observations_count);
        const bCount = normalizeObservationsCount(b.taxon?.observations_count);
        return (aCount ?? Number.POSITIVE_INFINITY) - (bCount ?? Number.POSITIVE_INFINITY);
      });
    } else if (sort === 'rarity_common') {
      sorted.sort((a, b) => {
        const aCount = normalizeObservationsCount(a.taxon?.observations_count);
        const bCount = normalizeObservationsCount(b.taxon?.observations_count);
        return (bCount ?? Number.NEGATIVE_INFINITY) - (aCount ?? Number.NEGATIVE_INFINITY);
      });
    }
    return sorted;
  };

  try {
    return await db.transaction('r', taxaTable, statsTable, async () => {
      const taxaInIconic = await taxaTable.where('iconic_taxon_id').equals(iconicId).toArray();
      const eligibleTaxa = taxaInIconic.filter(
        (taxon) =>
          isCollectionSpeciesTaxon(taxon) &&
          matchesRarity(taxon) &&
          matchesSearch(taxon)
      );
      const taxonIds = eligibleTaxa.map((taxon) => taxon.id);
      const statsForTaxa = taxonIds.length > 0 ? await statsTable.bulkGet(taxonIds) : [];

      let combined = eligibleTaxa.map((taxon, index) => {
        const rawStats = statsForTaxa[index] || null;
        return {
          taxon,
          stats: rawStats || defaultStatsFor(taxon.id),
          _rawStats: rawStats,
        };
      });

      combined = combined.filter((entry) => matchesStatus(entry._rawStats));
      combined = sortSpecies(combined);

      const total = combined.length;
      const species = combined
        .slice(offset, offset + limit)
        .map(({ taxon, stats }) => ({ taxon, stats }));

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
 */
export async function getSpeciesDetail(taxonId) {
  if (!taxonId) return null;

  try {
    return await db.transaction('r', taxaTable, statsTable, async () => {
      const [taxon, statObj] = await Promise.all([
        taxaTable.get(taxonId),
        statsTable.get(taxonId),
      ]);
      if (!taxon) return null;

      let ancestors = [];
      if (Array.isArray(taxon.ancestor_ids) && taxon.ancestor_ids.length > 0) {
        const ancestorsFromDb = await taxaTable.bulkGet(taxon.ancestor_ids);
        ancestors = ancestorsFromDb.filter(Boolean);
      }

      return { taxon, stats: statObj || null, ancestors };
    });
  } catch (error) {
    console.error(`Failed to get species detail for ${taxonId}:`, error);
    throw error;
  }
}

/**
 * Rebuild rarity tiers for existing taxa.
 */
export async function rebuildRarityTiers() {
  const taxa = await taxaTable.toArray();
  const updates = [];

  for (const taxon of taxa) {
    const observationsCount = normalizeObservationsCount(taxon?.observations_count);
    const nextTier = getRarityTier(observationsCount);
    const nextObservations = observationsCount ?? null;
    if (taxon?.id == null) continue;
    if (
      taxon.observations_count !== nextObservations ||
      taxon.rarity_tier !== nextTier
    ) {
      updates.push({
        id: taxon.id,
        observations_count: nextObservations,
        rarity_tier: nextTier,
      });
    }
  }

  if (!updates.length) return;

  await db.transaction('rw', taxaTable, async () => {
    for (const patch of updates) {
      await taxaTable.update(patch.id, patch);
    }
  });
}

/**
 * Update taxon description.
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
 * @param {Function} callback
 * @returns {Function} Unsubscribe
 */
export function onCollectionUpdated(callback) {
  if (typeof BroadcastChannel === 'undefined') return () => {};

  try {
    const channel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
    const handler = (event) => {
      if (event?.data?.type === 'COLLECTION_UPDATED') callback();
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
 * Find similar species (same genus) that could be confused.
 * @param {number} taxonId
 * @param {Array} ancestors
 */
export async function getSimilarSpecies(taxonId, ancestors = []) {
  try {
    let genusId = null;

    if (ancestors && ancestors.length > 0) {
      const genusAncestor = ancestors.find((a) => a.rank === 'genus');
      if (genusAncestor) genusId = genusAncestor.id;
    }

    if (!genusId) {
      try {
        const taxonResponse = await fetch(
          `https://api.inaturalist.org/v1/taxa/${taxonId}`,
        );
        if (taxonResponse.ok) {
          const taxonData = await taxonResponse.json();
          const taxonResult = taxonData.results?.[0];
          if (taxonResult?.ancestors) {
            const genusFromApi = taxonResult.ancestors.find(
              (a) => a.rank === 'genus',
            );
            if (genusFromApi) genusId = genusFromApi.id;
          }
        }
      } catch (err) {
        console.error('Failed to fetch taxon from API:', err);
      }
    }

    if (!genusId) return [];

    const url = `https://api.inaturalist.org/v1/taxa?taxon_id=${genusId}&rank=species&per_page=10&order=observations_count&order_by=desc`;
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) return [];

    const data = await response.json();
    return (data.results || []).filter((t) => t.id !== taxonId).slice(0, 5);
  } catch (error) {
    console.error('Failed to get similar species:', error);
    return [];
  }
}
