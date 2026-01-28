/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { getDefaultProfile, loadProfileFromStore, saveProfile } from '../services/PlayerProfile';
import { checkDailyStreak } from '../services/StreakService';
import { migrateLocalStorageToIndexedDB } from '../services/MigrationService';
import CollectionService, { MASTERY_LEVELS } from '../services/CollectionService';
import { getTaxaByIds } from '../services/api';
import { stats as statsTable, taxa as taxaTable } from '../services/db';

const UserContext = createContext(null);

const sanitizeProfile = (profileCandidate) => {
  const base = profileCandidate ?? getDefaultProfile();
  const { pokedex: _pokedex, ...rest } = base;
  return rest;
};

const TUTORIAL_STORAGE_KEY = 'inaturamouche_tutorial_seen';

const getLocalStorage = () => {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch (error) {
    console.warn('Access to localStorage is blocked', error);
    return null;
  }
};

const readTutorialSeenFlag = () => {
  const storage = getLocalStorage();
  if (!storage) return null;
  try {
    return storage.getItem(TUTORIAL_STORAGE_KEY);
  } catch (error) {
    console.warn('Unable to read tutorial flag from localStorage', error);
    return null;
  }
};

const writeTutorialSeenFlag = () => {
  const storage = getLocalStorage();
  if (!storage) return;
  try {
    storage.setItem(TUTORIAL_STORAGE_KEY, 'true');
  } catch (error) {
    console.warn('Unable to persist tutorial completion flag', error);
  }
};

/**
 * Load encyclopedia data from packs and seed database with taxon information.
 * Fetches full taxon data from iNaturalist API based on inaturalist_ids in packs.
 */
async function seedEncyclopedia() {
  try {
    // Load pack data (mushrooms and trees)
    const [mushrooms, trees] = await Promise.all([
      fetch('/packs/common_european_mushrooms.json').then(r => r.json()),
      fetch('/packs/common_european_trees.json').then(r => r.json()),
    ]);
    
    const allPackData = [...(mushrooms || []), ...(trees || [])];
    const inaturalistIds = allPackData
      .map(item => item.inaturalist_id)
      .filter(Boolean);
    
    console.log(`📚 Loading ${inaturalistIds.length} taxa from iNaturalist...`);
    
    // Process IDs in batches of 50 (server string limit is 500 chars)
    const BATCH_SIZE = 50;
    const allTaxaList = [];
    
    for (let i = 0; i < inaturalistIds.length; i += BATCH_SIZE) {
      const batchIds = inaturalistIds.slice(i, i + BATCH_SIZE);
      
      console.log(`  📡 Fetching batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(inaturalistIds.length / BATCH_SIZE)} (${batchIds.length} taxa)...`);
      
      const taxaList = await getTaxaByIds(batchIds, 'en');
      
      if (Array.isArray(taxaList)) {
        allTaxaList.push(...taxaList);
      }
    }
    
    if (allTaxaList.length === 0) {
      console.warn('⚠️ No taxa returned from server');
      return;
    }
    
    console.log(`📚 Seeding ${allTaxaList.length} taxa into database...`);
    
    // Seed into CollectionService (handles transaction, batching, etc.)
    await CollectionService.seedTaxa(allTaxaList, {
      onProgress: (count) => {
        if (count % 50 === 0) {
          console.log(`  ✓ Seeded ${count}/${allTaxaList.length}`);
        }
      },
    });
    
    const finalCount = await taxaTable.count();
    console.log(`✅ Encyclopedia seeded: ${finalCount} taxa available`);
    
    // Log breakdown by iconic
    const allTaxa = await taxaTable.toArray();
    const byIconic = {};
    for (const taxon of allTaxa) {
      const iconicId = taxon.iconic_taxon_id;
      if (!byIconic[iconicId]) byIconic[iconicId] = 0;
      byIconic[iconicId]++;
    }
    console.log('📊 Taxa breakdown by iconic:', byIconic);
  } catch (error) {
    console.error('❌ Failed to seed encyclopedia:', error);
  }
}

export function UserProvider({ children }) {
  const [profile, setProfile] = useState(() => sanitizeProfile());
  const [achievementQueue, setAchievementQueue] = useState([]);
  const [collectionVersion, setCollectionVersion] = useState(0);
  const [showTutorial, setShowTutorial] = useState(false);

  // Initialize: load profile, migrate legacy data, and seed encyclopedia
  useEffect(() => {
    let isMounted = true;
    let cancelSeeding = null;

    const scheduleIdleTask = (task) => {
      if (typeof window === 'undefined') {
        void task();
        return () => {};
      }
      if (typeof window.requestIdleCallback === 'function') {
        const id = window.requestIdleCallback(() => {
          void task();
        }, { timeout: 2000 });
        return () => window.cancelIdleCallback?.(id);
      }
      const id = window.setTimeout(() => {
        void task();
      }, 1500);
      return () => window.clearTimeout(id);
    };

    const initialize = async () => {
      let migrationApplied = false;
      try {
        migrationApplied = await migrateLocalStorageToIndexedDB();
      } catch (migrationError) {
        console.error('Failed to migrate legacy collection', migrationError);
      }
      try {
        let loadedProfile = await loadProfileFromStore();
        
        // Check daily streak on app load
        loadedProfile = checkDailyStreak(loadedProfile);
        
        if (!isMounted) return;
        setProfile(sanitizeProfile(loadedProfile));
        
        // Save updated profile if streak check made changes
        if (loadedProfile !== await loadProfileFromStore()) {
          await saveProfile(loadedProfile);
        }
      } catch (loadError) {
        console.error('Failed to load profile', loadError);
        if (isMounted) {
          setProfile(sanitizeProfile());
        }
      }
      
      // Seed encyclopedia if needed. Use a localStorage flag to avoid partial seeding issues.
      try {
        const storage = getLocalStorage();
        const seedingFlag = storage?.getItem('SEEDING_COMPLETE_V1');
        const count = await taxaTable.count();
        console.log(`📊 DB Initialisée : ${count} espèces disponibles.`);

        if (!seedingFlag || count === 0) {
          const reason = !seedingFlag ? 'flag missing' : 'db empty';
          cancelSeeding = scheduleIdleTask(async () => {
            try {
              console.log(`🌱 Seeding encyclopedia (${reason})...`);
              await seedEncyclopedia();
              // Only mark seeding complete once it finished without throwing
              storage?.setItem('SEEDING_COMPLETE_V1', '1');
              if (isMounted) {
                setCollectionVersion((prev) => prev + 1);
              }
            } catch (seedErr) {
              // Don't set the flag - seeding failed/aborted; let next init attempt retry
              console.error('❌ Seeding failed, will retry on next launch:', seedErr);
            }
          });
        }
      } catch (e) {
        console.error('Erreur lecture DB', e);
      }

      // Rebuild rarity tiers once using locally stored observations_count data.
      try {
        const storage = getLocalStorage();
        const rarityFlag = storage?.getItem('RARITY_REBUILD_V6');
        if (!rarityFlag) {
          await CollectionService.rebuildRarityTiers();
          storage?.setItem('RARITY_REBUILD_V6', '1');
        }
      } catch (err) {
        console.warn('Rarity rebuild skipped:', err);
      }
      
      // Update collectionVersion if any data changes happened
      if (migrationApplied && isMounted) {
        setCollectionVersion((prev) => prev + 1);
      }
    };
    void initialize();
    return () => {
      isMounted = false;
      if (cancelSeeding) cancelSeeding();
    };
  }, []);

  // Check if tutorial should be shown for first-time users
  useEffect(() => {
    const tutorialSeen = readTutorialSeenFlag();
    if (!tutorialSeen) {
      setShowTutorial(true);
    }
  }, []);

  const completeTutorial = useCallback(() => {
    writeTutorialSeenFlag();
    setShowTutorial(false);
  }, []);
  useEffect(() => {
    const unsubscribe = CollectionService.onCollectionUpdated(() => {
      setCollectionVersion((prev) => prev + 1);
    });
    return unsubscribe;
  }, []);

  const refreshProfile = useCallback(async () => {
    const loadedProfile = await loadProfileFromStore();
    setProfile(sanitizeProfile(loadedProfile));
  }, []);

  const updateProfile = useCallback((updater) => {
    setProfile((prev) => {
      const base = prev ?? sanitizeProfile();
      const next = typeof updater === 'function' ? updater(base) : updater;
      const sanitized = sanitizeProfile(next);
      void saveProfile(sanitized);
      return sanitized;
    });
  }, []);

  /**
   * Record an encounter with a taxon (primary gameplay method).
   * Delegates to CollectionService.recordEncounter.
   */
  const recordEncounter = useCallback(async (taxonData, isCorrect = false, thumbnail = null) => {
    if (!taxonData?.id) return null;
    try {
      const result = await CollectionService.recordEncounter(taxonData, {
        isCorrect,
        thumbnail,
        occurredAt: new Date(),
      });
      setCollectionVersion((prev) => prev + 1);
      return result;
    } catch (error) {
      console.error('Failed to record encounter', error);
      return null;
    }
  }, []);

  /**
   * Legacy alias for recordEncounter (maintains backward compatibility).
   */
  const addSpeciesToCollection = useCallback(
    (taxon, isCorrect = false, thumbnail) => recordEncounter(taxon, isCorrect, thumbnail),
    [recordEncounter]
  );

  /**
   * Legacy alias for recordEncounter.
   */
  const updatePokedex = useCallback(
    (species, isCorrect, thumbnail) => recordEncounter(species, isCorrect, thumbnail),
    [recordEncounter]
  );

  /**
   * Get collection stats/summary across all species.
   */
  const getCollectionStats = useCallback(async () => {
    try {
      const allStats = await statsTable.toArray();
      const allTaxa = await taxaTable.toArray();

      let masteredSpecies = 0;
      let lastSeenAt = null;

      for (const stat of allStats) {
        if (stat.masteryLevel > MASTERY_LEVELS.NONE) {
          masteredSpecies += 1;
        }
        if (stat.lastSeenAt && (!lastSeenAt || new Date(stat.lastSeenAt) > new Date(lastSeenAt))) {
          lastSeenAt = stat.lastSeenAt;
        }
      }

      return {
        totalSpecies: allTaxa.length,
        seenSpecies: allStats.length,
        masteredSpecies,
        lastSeenAt,
      };
    } catch (error) {
      console.error('Failed to read collection stats', error);
      return {
        totalSpecies: 0,
        seenSpecies: 0,
        masteredSpecies: 0,
        lastSeenAt: null,
      };
    }
  }, []);

  /**
   * Get species detail via CollectionService.
   */
  const getSpeciesDetail = useCallback((taxonId) => {
    if (!taxonId) return null;
    return CollectionService.getSpeciesDetail(taxonId);
  }, []);

  /**
   * Legacy: get species by ID (returns taxon only).
   */
  const getSpeciesById = useCallback((id) => {
    if (!id) return null;
    return taxaTable.get(id);
  }, []);

  /**
   * Legacy: get stats by ID.
   */
  const getSpeciesStats = useCallback((id) => {
    if (!id) return null;
    return statsTable.get(id);
  }, []);

  const queueAchievements = useCallback((ids = []) => {
    if (!ids.length) return;
    setAchievementQueue((prev) => [...prev, ...ids]);
  }, []);

  const popAchievement = useCallback(() => {
    setAchievementQueue((prev) => prev.slice(1));
  }, []);

  const value = {
    profile,
    updateProfile,
    refreshProfile,
    achievementQueue,
    queueAchievements,
    popAchievement,
    recordEncounter,
    addSpeciesToCollection, // Legacy
    updatePokedex, // Legacy
    getCollectionStats,
    getSpeciesDetail,
    getSpeciesById, // Legacy
    getSpeciesStats, // Legacy
    collectionVersion,
    showTutorial,
    completeTutorial,
  };

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser() {
  const context = useContext(UserContext);
  if (!context) throw new Error('useUser must be used within a UserProvider');
  return context;
}
