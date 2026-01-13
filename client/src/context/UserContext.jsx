/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { getDefaultProfile, loadProfileFromStore, saveProfile } from '../services/PlayerProfile';
import db, { speciesTable, statsTable } from '../services/db';
import { migrateLocalStorageToIndexedDB } from '../services/MigrationService';
import { buildSpeciesPayload } from '../utils/speciesUtils';
import { MASTERY_LEVELS, MASTERY_THRESHOLDS } from '../services/CollectionService';
import { MASTERY_THRESHOLD } from '../utils/scoring';
import { queueTaxonForEnrichment } from '../services/TaxonomyService';

const UserContext = createContext(null);

const sanitizeProfile = (profileCandidate) => {
  const base = profileCandidate ?? getDefaultProfile();
  const { pokedex: _pokedex, ...rest } = base;
  return rest;
};

const calculateMasteryLevel = ({ correctCount = 0, seenCount = 0 }) => {
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
};

export function UserProvider({ children }) {
  const [profile, setProfile] = useState(() => sanitizeProfile());
  const [achievementQueue, setAchievementQueue] = useState([]);
  const [collectionVersion, setCollectionVersion] = useState(0);

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
        const count = await speciesTable.count();
        console.log(`📊 DB Initialisée : ${count} espèces disponibles.`);
      } catch (e) { console.error("Erreur lecture DB", e); }
    };
    void initialize();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const BroadcastChannelConstructor =
      typeof BroadcastChannel !== 'undefined'
        ? BroadcastChannel
        : undefined;
    if (!BroadcastChannelConstructor) return undefined;
    const channel = new BroadcastChannelConstructor('inaturamouche_channel');
    const handleMessage = (event) => {
      if (event?.data?.type === 'COLLECTION_UPDATED') {
        setCollectionVersion((prev) => prev + 1);
      }
    };
    channel.addEventListener('message', handleMessage);
    return () => {
      channel.removeEventListener('message', handleMessage);
      channel.close();
    };
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

  const addSpeciesToCollection = useCallback(async (taxon, isCorrect = false, thumbnail) => {
    if (!taxon?.id) return;
    const payload = buildSpeciesPayload(taxon, thumbnail);
    if (!payload) return;
    const now = new Date().toISOString();
    const wasCorrect = Boolean(isCorrect);
    let shouldQueueEnrichment = false;
    try {
      await db.transaction('rw', speciesTable, statsTable, async () => {
        const [existingStats, existingSpecies] = await Promise.all([
          statsTable.get(taxon.id),
          speciesTable.get(taxon.id),
        ]);
        const seenCount = (Number(existingStats?.seenCount) || 0) + 1;
        const correctCount = (Number(existingStats?.correctCount) || 0) + (wasCorrect ? 1 : 0);
        const streak = wasCorrect ? (Number(existingStats?.streak) || 0) + 1 : 0;
        const firstSeenAt = existingStats?.firstSeenAt || now;
        const masteryLevel = calculateMasteryLevel({ correctCount, seenCount });
        await statsTable.put({
          id: taxon.id,
          seenCount,
          correctCount,
          streak,
          firstSeenAt,
          lastSeenAt: now,
          accuracy: seenCount ? correctCount / seenCount : 0,
          masteryLevel,
        });
        const hasAncestorData =
          existingSpecies &&
          Array.isArray(existingSpecies.ancestor_ids) &&
          existingSpecies.ancestor_ids.length > 0;
        const hasIconicTaxon = Number.isFinite(Number(existingSpecies?.iconic_taxon_id));
        const hasImageUrls = Boolean(
          existingSpecies?.square_url ||
          existingSpecies?.small_url ||
          existingSpecies?.medium_url ||
          existingSpecies?.thumbnail
        );
        if (!existingSpecies || !hasAncestorData || !hasIconicTaxon || !hasImageUrls) {
          const mergedPayload = existingSpecies ? { ...existingSpecies, ...payload } : payload;
          if (hasAncestorData && (!payload?.ancestor_ids || payload.ancestor_ids.length === 0)) {
            mergedPayload.ancestor_ids = existingSpecies.ancestor_ids;
          }
          await speciesTable.put(mergedPayload);
          if (!hasAncestorData) {
            shouldQueueEnrichment = true;
          }
        }
      });
      if (shouldQueueEnrichment) {
        queueTaxonForEnrichment(taxon.id);
      }
      setCollectionVersion((prev) => prev + 1);
    } catch (error) {
      console.error('Failed to persist collection entry', error);
    }
  }, []);

  const updatePokedex = useCallback((species, isCorrect, thumbnail) => {
    void addSpeciesToCollection(species, isCorrect, thumbnail);
  }, [addSpeciesToCollection]);

  const getCollectionStats = useCallback(async () => {
    try {
      const [totalSpecies, statsEntries] = await Promise.all([
        speciesTable.count(),
        statsTable.toArray(),
      ]);
      let masteredSpecies = 0;
      let lastSeenAt = null;
      statsEntries.forEach((entry) => {
        if (!entry) return;
        const correctCount = Number(entry.correctCount) || 0;
        if (correctCount >= MASTERY_THRESHOLD) masteredSpecies += 1;
        if (entry.lastSeenAt && (!lastSeenAt || entry.lastSeenAt > lastSeenAt)) {
          lastSeenAt = entry.lastSeenAt;
        }
      });
      return {
        totalSpecies,
        masteredSpecies,
        lastSeenAt,
      };
    } catch (error) {
      console.error('Failed to read collection stats', error);
      return {
        totalSpecies: 0,
        masteredSpecies: 0,
        lastSeenAt: null,
      };
    }
  }, []);

  const getSpeciesById = useCallback((id) => {
    if (!id) return null;
    return speciesTable.get(id);
  }, []);

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
    addSpeciesToCollection,
    updatePokedex,
    getCollectionStats,
    getSpeciesById,
    getSpeciesStats,
    collectionVersion,
  };

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser() {
  const context = useContext(UserContext);
  if (!context) throw new Error('useUser must be used within a UserProvider');
  return context;
}
