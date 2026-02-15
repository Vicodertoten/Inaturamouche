import { profiles } from './db.js';
import { notify } from './notifications.js';
import { getDefaultRewardState, mergeRewardState } from '../core/achievements/rewards.js';

const LEGACY_STORAGE_KEY = 'inaturamouche_playerProfile';
const LEGACY_IDB_NAME = 'inaturamouche-player';
const PROFILE_KEY = 'playerProfile';

export const getDefaultProfile = () => ({
  xp: 0,
  stats: {
    gamesPlayed: 0,
    easyQuestionsAnswered: 0,
    hardQuestionsAnswered: 0,
    riddleQuestionsAnswered: 0,
    correctEasy: 0,
    correctHard: 0,
    correctRiddle: 0,
    accuracyEasy: 0,
    accuracyHard: 0,
    accuracyRiddle: 0,
    speciesMastery: {},
    missedSpecies: [],
    packsPlayed: {},
    currentStreak: 0,
    longestStreak: 0,
    // Nouveaux champs pour les succès
    weekendWarriorCompleted: false,
    lastPlayedDays: [], // Pour tracker samedi/dimanche
    consecutiveFastAnswers: 0, // Pour SPEED_LIGHTNING
    totalHintsUsed: 0,
    totalQuestionsAnswered: 0,
    hardGamesCompleted: 0,
    reviewSessionsCompleted: 0,
    consecutiveReviewDays: 0,
    lastReviewDate: null,
  },
  achievements: [],
  pokedex: {},
  dailyStreak: {
    current: 0,
    longest: 0,
    lastPlayedDate: null,
    shields: 0,
    shieldUsedToday: false,
    streakBonusXP: 0,
    streakMilestones: {
      7: false,
      14: false,
      30: false,
    },
  },
  // Nouveau: système de récompenses avancé
  rewards: getDefaultRewardState(),
});

const mergeProfileWithDefaults = (loadedProfile = {}) => {
  const safeProfile =
    loadedProfile && typeof loadedProfile === 'object' && !Array.isArray(loadedProfile)
      ? loadedProfile
      : {};
  const defaultProfile = getDefaultProfile();
  
  // Migration : totalScore → xp
  // Si totalScore existe mais pas xp, on migre
  let migratedXP = safeProfile.xp || 0;
  if (safeProfile.totalScore && !safeProfile.xp) {
    migratedXP = safeProfile.totalScore;
    console.log('[PlayerProfile] Migrating totalScore to xp:', safeProfile.totalScore);
  }
  
  const finalProfile = {
    ...defaultProfile,
    ...safeProfile,
    xp: migratedXP,
    stats: {
      ...defaultProfile.stats,
      ...(safeProfile.stats || {}),
    },
    pokedex: safeProfile.pokedex || {},
    dailyStreak: {
      ...defaultProfile.dailyStreak,
      ...(safeProfile.dailyStreak || {}),
    },
    // Fusionner les rewards avec les valeurs par défaut
    rewards: mergeRewardState(safeProfile.rewards),
  };

  if (finalProfile.stats.packsPlayed) {
    const migrated = {};
    Object.entries(finalProfile.stats.packsPlayed).forEach(([packId, data]) => {
      if (typeof data === 'number') {
        migrated[packId] = { correct: 0, answered: 0 };
      } else {
        migrated[packId] = {
          correct: data.correct || 0,
          answered: data.answered || 0,
        };
      }
    });
    finalProfile.stats.packsPlayed = migrated;
  } else {
    finalProfile.stats.packsPlayed = {};
  }

  if (finalProfile.stats.speciesMastery) {
    Object.entries(finalProfile.stats.speciesMastery).forEach(([id, val]) => {
      if (typeof val === 'number') {
        finalProfile.stats.speciesMastery[id] = { correct: val };
      } else {
        finalProfile.stats.speciesMastery[id] = { correct: val.correct || 0 };
      }
    });
  } else {
    finalProfile.stats.speciesMastery = {};
  }

  if (Array.isArray(finalProfile.stats.missedSpecies)) {
    const normalized = finalProfile.stats.missedSpecies
      .map((entry) => parseInt(entry, 10))
      .filter((id) => !Number.isNaN(id));
    finalProfile.stats.missedSpecies = Array.from(new Set(normalized));
  } else {
    finalProfile.stats.missedSpecies = [];
  }

  // Supprimer totalScore après migration
  delete finalProfile.totalScore;
  
  return finalProfile;
};

const migrateLegacyProfile = () => {
  if (typeof localStorage === 'undefined') return null;
  try {
    const profileJson = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!profileJson) return null;
    localStorage.removeItem(LEGACY_STORAGE_KEY);
    return JSON.parse(profileJson);
  } catch (error) {
    console.warn('Legacy profile migration failed', error);
    return null;
  }
};

/**
 * Migrate profile from the old idb-based 'inaturamouche-player' database.
 * Returns the stored profile or null. Deletes the legacy DB once migrated.
 */
const migrateLegacyIdbProfile = async () => {
  try {
    const dbs = await indexedDB.databases?.();
    const legacyExists = dbs?.some((d) => d.name === LEGACY_IDB_NAME);
    if (!legacyExists) return null;

    return new Promise((resolve) => {
      const req = indexedDB.open(LEGACY_IDB_NAME, 1);
      req.onerror = () => resolve(null);
      req.onsuccess = (event) => {
        const db = event.target.result;
        try {
          if (!db.objectStoreNames.contains('playerProfiles')) {
            db.close();
            return resolve(null);
          }
          const tx = db.transaction('playerProfiles', 'readonly');
          const store = tx.objectStore('playerProfiles');
          const getReq = store.get('playerProfile');
          getReq.onsuccess = () => {
            const data = getReq.result;
            db.close();
            // Delete legacy database
            indexedDB.deleteDatabase(LEGACY_IDB_NAME);
            console.log('[PlayerProfile] Migrated from legacy idb database');
            resolve(data || null);
          };
          getReq.onerror = () => {
            db.close();
            resolve(null);
          };
        } catch {
          db.close();
          resolve(null);
        }
      };
      req.onupgradeneeded = (event) => {
        // Legacy DB doesn't exist yet — nothing to migrate
        event.target.transaction.abort();
        resolve(null);
      };
    });
  } catch {
    return null;
  }
};

export const loadProfileWithDefaults = () => getDefaultProfile();

export const loadProfileFromStore = async () => {
  try {
    const row = await profiles.get(PROFILE_KEY);
    let stored = row?.data ?? null;

    if (!stored) {
      // Try legacy idb database first, then localStorage
      stored = await migrateLegacyIdbProfile();
      if (!stored) {
        stored = migrateLegacyProfile();
      }
      if (stored) {
        try {
          await profiles.put({ key: PROFILE_KEY, data: stored });
        } catch (error) {
          console.warn('Failed to persist migrated profile to IndexedDB', error);
        }
      }
    }
    return mergeProfileWithDefaults(stored);
  } catch (error) {
    notify('Impossible de charger le profil.', { type: 'error' });
    return getDefaultProfile();
  }
};

/**
 * Save profile to IndexedDB.
 * FIX #3: Returns success status to allow caller to handle errors.
 * 
 * @param {Object} profile - Profile to save
 * @returns {Promise<{success: boolean, error?: Error}>}
 */
export const saveProfile = async (profile) => {
  try {
    await profiles.put({ key: PROFILE_KEY, data: profile });
    return { success: true };
  } catch (error) {
    notify('Impossible de sauvegarder le profil.', { type: 'error' });
    return { success: false, error };
  }
};

export const resetProfile = async () => {
  try {
    await profiles.delete(PROFILE_KEY);
  } catch (error) {
    notify('Impossible de reinitialiser le profil.', { type: 'error' });
  }
};
