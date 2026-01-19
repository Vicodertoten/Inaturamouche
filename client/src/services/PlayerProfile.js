import { openDB } from 'idb';
import { notify } from './notifications.js';
import { getDefaultRewardState, mergeRewardState } from '../core/achievements/rewards.js';

const LEGACY_STORAGE_KEY = 'inaturamouche_playerProfile';
const DB_NAME = 'inaturamouche-player';
const DB_VERSION = 1;
const STORE_NAME = 'playerProfiles';
const PROFILE_STORE_KEY = 'playerProfile';

let dbPromise;

const getDb = () => {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      },
    });
  }
  return dbPromise;
};

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

export const loadProfileWithDefaults = () => getDefaultProfile();

export const loadProfileFromStore = async () => {
  try {
    const db = await getDb();
    let stored = await db.get(STORE_NAME, PROFILE_STORE_KEY);
    if (!stored) {
      const legacy = migrateLegacyProfile();
      if (legacy) {
        stored = legacy;
        try {
          await db.put(STORE_NAME, stored, PROFILE_STORE_KEY);
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
    const db = await getDb();
    await db.put(STORE_NAME, profile, PROFILE_STORE_KEY);
    return { success: true };
  } catch (error) {
    notify('Impossible de sauvegarder le profil.', { type: 'error' });
    return { success: false, error };
  }
};

export const resetProfile = async () => {
  try {
    const db = await getDb();
    await db.delete(STORE_NAME, PROFILE_STORE_KEY);
  } catch (error) {
    notify('Impossible de reinitialiser le profil.', { type: 'error' });
  }
};
