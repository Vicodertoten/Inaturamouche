/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { getDefaultProfile, loadProfileFromStore, saveProfile } from '../services/PlayerProfile';
import { migrateLocalStorageToIndexedDB } from '../services/MigrationService';
import CollectionService, { MASTERY_LEVELS } from '../services/CollectionService';
import { stats as statsTable, taxa as taxaTable } from '../services/db';

const UserContext = createContext(null);

const sanitizeProfile = (profileCandidate) => {
  const base = profileCandidate ?? getDefaultProfile();
  const { pokedex: _pokedex, ...rest } = base;
  return rest;
};

export function UserProvider({ children }) {
  const [profile, setProfile] = useState(() => sanitizeProfile());
  const [achievementQueue, setAchievementQueue] = useState([]);
  const [collectionVersion, setCollectionVersion] = useState(0);

  // Initialize: load profile and migrate legacy data
  useEffect(() => {
    let isMounted = true;
    const initialize = async () => {
      let migrationApplied = false;
      try {
        migrationApplied = await migrateLocalStorageToIndexedDB();
      } catch (migrationError) {
        console.error('Failed to migrate legacy collection', migrationError);
      }
      try {
        const loadedProfile = await loadProfileFromStore();
        if (!isMounted) return;
        setProfile(sanitizeProfile(loadedProfile));
      } catch (loadError) {
        console.error('Failed to load profile', loadError);
        if (isMounted) {
          setProfile(sanitizeProfile());
        }
      }
      if (migrationApplied && isMounted) {
        setCollectionVersion((prev) => prev + 1);
      }
      try {
        const count = await taxaTable.count();
        console.log(`📊 DB Initialisée : ${count} espèces disponibles.`);
      } catch (e) {
        console.error("Erreur lecture DB", e);
      }
    };
    void initialize();
    return () => {
      isMounted = false;
    };
  }, []);

  // Listen for BroadcastChannel collection updates from other tabs
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
  };

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser() {
  const context = useContext(UserContext);
  if (!context) throw new Error('useUser must be used within a UserProvider');
  return context;
}
