import db, { speciesTable, statsTable } from './db.js';

export const MASTERY_LEVELS = Object.freeze({
  NONE: 0,
  BRONZE: 1, // Discovery
  SILVER: 2, // Familiar
  GOLD: 3,   // Expert
  DIAMOND: 4 // Master (Reserved for Hard Mode)
});

export const MASTERY_NAMES = Object.freeze({
  0: 'Unseen',
  1: 'Bronze',
  2: 'Silver',
  3: 'Gold',
  4: 'Diamond'
});

export const MASTERY_THRESHOLDS = Object.freeze({
  [MASTERY_LEVELS.BRONZE]: { correct: 1, ratio: 0 },
  [MASTERY_LEVELS.SILVER]: { correct: 5, ratio: 0 },
  [MASTERY_LEVELS.GOLD]: { correct: 10, ratio: 0.8 },
  [MASTERY_LEVELS.DIAMOND]: { correct: 20, ratio: 0.95 } // Example for future use
});

const PLACEHOLDER_IMAGE_URL = '/placeholder.svg'; // A default image if none is provided

/**
 * Calculates the mastery level based on player statistics for a taxon.
 * @param {object} stats - The collection stats for a taxon.
 * @param {number} stats.correctCount - Number of correct identifications.
 * @param {number} stats.seenCount - Number of times seen.
 * @returns {number} The calculated mastery level.
 */
function _calculateMasteryLevel({ correctCount = 0, seenCount = 0 }) {
  const ratio = seenCount > 0 ? correctCount / seenCount : 0;

  if (correctCount >= MASTERY_THRESHOLDS[MASTERY_LEVELS.GOLD].correct && ratio >= MASTERY_THRESHOLDS[MASTERY_LEVELS.GOLD].ratio) {
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
 * Registers a player's encounter with a taxon, updating stats and taxon info.
 * This is the primary method for tracking player progress.
 *
 * @param {object} taxonData - The full taxon data from iNaturalist API.
 * @param {boolean} isCorrect - Whether the player's answer was correct.
 * @returns {Promise<{levelUp: boolean, isNew: boolean, oldLevel: number|null, newLevel: number|null}>} 
 *          An object indicating if a mastery level was gained and if it's a new species.
 */
export async function registerEncounter(taxonData, isCorrect) {
  if (!taxonData || !taxonData.id) {
    throw new Error('Invalid taxonData provided to registerEncounter.');
  }

  const taxonId = taxonData.id;
  let result = { levelUp: false, isNew: false, oldLevel: null, newLevel: null };

  await db.transaction('rw', speciesTable, statsTable, async () => {
    // 1. Upsert taxon information into the encyclopedia
    const photo = taxonData.default_photo;
    await speciesTable.put({
      id: taxonId,
      name: taxonData.name,
      preferred_common_name: taxonData.preferred_common_name,
      rank: taxonData.rank,
      iconic_taxon_id: taxonData.iconic_taxon_id,
      ancestor_ids: taxonData.ancestor_ids || [],
      square_url: photo ? photo.square_url : PLACEHOLDER_IMAGE_URL,
      small_url: photo ? photo.small_url : PLACEHOLDER_IMAGE_URL,
      medium_url: photo ? photo.medium_url : PLACEHOLDER_IMAGE_URL,
      thumbnail: photo ? (photo.square_url || photo.url) : PLACEHOLDER_IMAGE_URL,
      wikipedia_url: taxonData.wikipedia_url
    });

    // 2. Update player's collection stats
    const existingStats = await statsTable.get(taxonId);
    const oldLevel = existingStats ? existingStats.masteryLevel : MASTERY_LEVELS.NONE;
    result.isNew = !existingStats;

    const newStats = {
      seenCount: (existingStats?.seenCount || 0) + 1,
      correctCount: isCorrect ? (existingStats?.correctCount || 0) + 1 : (existingStats?.correctCount || 0),
      streak: isCorrect ? (existingStats?.streak || 0) + 1 : 0,
      firstSeenAt: existingStats?.firstSeenAt || new Date(),
      lastSeenAt: new Date(),
    };
    newStats.accuracy = newStats.seenCount > 0 ? newStats.correctCount / newStats.seenCount : 0;

    // 3. Calculate new mastery level
    const newLevel = _calculateMasteryLevel(newStats);

    // 4. Save the updated stats and new mastery level
    await statsTable.put({
      id: taxonId,
      ...newStats,
      masteryLevel: newLevel
    });

    // 5. Determine if a level up occurred
    if (newLevel > oldLevel) {
        result.levelUp = true;
        result.oldLevel = oldLevel;
        result.newLevel = newLevel;
    } else {
        result.oldLevel = oldLevel;
        result.newLevel = newLevel;
    }
  });

  return result;
}

/**
 * Provides a summary of the player's collection.
 *
 * @returns {Promise<{total: number, bronze: number, silver: number, gold: number, diamond: number, none: number}>}
 *          An object with counts for total species and for each mastery level.
 */
export async function getCollectionSummary() {
  const allEntries = await statsTable.toArray();
  const summary = {
    total: allEntries.length,
    [MASTERY_LEVELS.NONE]: 0,
    [MASTERY_LEVELS.BRONZE]: 0,
    [MASTERY_LEVELS.SILVER]: 0,
    [MASTERY_LEVELS.GOLD]: 0,
    [MASTERY_LEVELS.DIAMOND]: 0,
  };

  for (const entry of allEntries) {
    summary[entry.masteryLevel]++;
  }

  return {
      total: summary.total,
      none: summary[MASTERY_LEVELS.NONE],
      bronze: summary[MASTERY_LEVELS.BRONZE],
      silver: summary[MASTERY_LEVELS.SILVER],
      gold: summary[MASTERY_LEVELS.GOLD],
      diamond: summary[MASTERY_LEVELS.DIAMOND],
  };
}


/**
 * Updates the description for a specific taxon in the database.
 * @param {number} taxonId - The iNaturalist taxon ID.
 * @param {string} description - The new description text.
 * @returns {Promise<number>} A promise that resolves to the number of updated records.
 */
export async function updateTaxonDescription(taxonId, description) {
    // Also add the 'description' field to the taxa table schema in db.js
    return await speciesTable.update(taxonId, { description });
}

const CollectionService = {
  MASTERY_LEVELS,
  MASTERY_NAMES,
  MASTERY_THRESHOLDS,
  registerEncounter,
  getCollectionSummary,
  updateTaxonDescription
};

export default CollectionService;
