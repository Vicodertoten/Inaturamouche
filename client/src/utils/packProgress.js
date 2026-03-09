/**
 * packProgress.js — Compute per-pack mastery progress for list packs.
 *
 * For packs whose full species list (`taxa_ids`) is known, we can
 * calculate what percentage of species the player has encountered
 * and mastered.
 */
import { stats as statsTable } from '../services/db.js';
import { MASTERY_LEVELS } from '../services/collection/MasteryEngine.js';

/**
 * Compute mastery progress for a single pack.
 *
 * @param {number[]} taxaIds - All taxon IDs in the pack
 * @returns {Promise<{
 *   total: number,
 *   seen: number,
 *   mastered: number,
 *   progressPercent: number,
 *   masteryBreakdown: Record<number, number>,
 * }>}
 */
export async function getPackProgress(taxaIds) {
  if (!Array.isArray(taxaIds) || taxaIds.length === 0) {
    return { total: 0, seen: 0, mastered: 0, progressPercent: 0, masteryBreakdown: {} };
  }

  const total = taxaIds.length;

  try {
    // Bulk-get stats for all taxon IDs in the pack
    const statsList = await statsTable.bulkGet(taxaIds);

    let seen = 0;
    let mastered = 0;
    const masteryBreakdown = {
      [MASTERY_LEVELS.NONE]: 0,
      [MASTERY_LEVELS.BRONZE]: 0,
      [MASTERY_LEVELS.SILVER]: 0,
      [MASTERY_LEVELS.GOLD]: 0,
      [MASTERY_LEVELS.DIAMOND]: 0,
    };

    for (const stat of statsList) {
      if (!stat) {
        masteryBreakdown[MASTERY_LEVELS.NONE] += 1;
        continue;
      }
      seen += 1;
      const level = stat.masteryLevel ?? MASTERY_LEVELS.NONE;
      masteryBreakdown[level] = (masteryBreakdown[level] || 0) + 1;
      if (level >= MASTERY_LEVELS.GOLD) {
        mastered += 1;
      }
    }

    // Count the NONE entries for species not yet seen
    masteryBreakdown[MASTERY_LEVELS.NONE] = total - seen;

    return {
      total,
      seen,
      mastered,
      progressPercent: total > 0 ? Math.round((mastered / total) * 100) : 0,
      masteryBreakdown,
    };
  } catch (error) {
    console.error('Failed to compute pack progress:', error);
    return { total, seen: 0, mastered: 0, progressPercent: 0, masteryBreakdown: {} };
  }
}

/**
 * Compute progress for multiple packs at once.
 *
 * @param {Array<{id: string, taxa_ids?: number[]}>} packs
 * @returns {Promise<Record<string, Awaited<ReturnType<typeof getPackProgress>>>>}
 */
export async function getMultiPackProgress(packs) {
  const results = {};
  const listPacks = packs.filter((p) => Array.isArray(p.taxa_ids) && p.taxa_ids.length > 0);

  if (listPacks.length === 0) return results;

  // Collect all unique taxon IDs across all packs for a single bulk query
  const allIds = new Set();
  for (const pack of listPacks) {
    for (const id of pack.taxa_ids) allIds.add(id);
  }

  let statsMap;
  try {
    const allIdArr = [...allIds];
    const allStats = await statsTable.bulkGet(allIdArr);
    statsMap = new Map();
    for (let i = 0; i < allIdArr.length; i++) {
      if (allStats[i]) statsMap.set(allIdArr[i], allStats[i]);
    }
  } catch {
    statsMap = new Map();
  }

  for (const pack of listPacks) {
    const total = pack.taxa_ids.length;
    let seen = 0;
    let mastered = 0;
    const masteryBreakdown = {
      [MASTERY_LEVELS.NONE]: 0,
      [MASTERY_LEVELS.BRONZE]: 0,
      [MASTERY_LEVELS.SILVER]: 0,
      [MASTERY_LEVELS.GOLD]: 0,
      [MASTERY_LEVELS.DIAMOND]: 0,
    };

    for (const taxonId of pack.taxa_ids) {
      const stat = statsMap.get(taxonId);
      if (!stat) {
        masteryBreakdown[MASTERY_LEVELS.NONE] += 1;
        continue;
      }
      seen += 1;
      const level = stat.masteryLevel ?? MASTERY_LEVELS.NONE;
      masteryBreakdown[level] = (masteryBreakdown[level] || 0) + 1;
      if (level >= MASTERY_LEVELS.GOLD) {
        mastered += 1;
      }
    }
    masteryBreakdown[MASTERY_LEVELS.NONE] = total - seen;

    results[pack.id] = {
      total,
      seen,
      mastered,
      progressPercent: total > 0 ? Math.round((mastered / total) * 100) : 0,
      masteryBreakdown,
    };
  }

  return results;
}
