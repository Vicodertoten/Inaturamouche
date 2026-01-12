/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useState } from 'react';
import { loadProfileWithDefaults, saveProfile } from '../services/PlayerProfile';

const UserContext = createContext(null);

export function UserProvider({ children }) {
  const [profile, setProfile] = useState(() => loadProfileWithDefaults());
  const [achievementQueue, setAchievementQueue] = useState([]);

  const refreshProfile = useCallback(() => {
    setProfile(loadProfileWithDefaults());
  }, []);

  const updateProfile = useCallback((updater) => {
    setProfile((prev) => {
      const base = prev ?? loadProfileWithDefaults();
      const next = typeof updater === 'function' ? updater(base) : updater;
      saveProfile(next);
      return next;
    });
  }, []);

  const updatePokedex = useCallback((species, isCorrect, thumbnail) => {
    updateProfile(prevProfile => {
      const { id, name, preferred_common_name, iconic_taxon_id, ancestor_ids } = species;
      const now = new Date().toISOString();

      const newPokedex = { ...prevProfile.pokedex };
      let entry = newPokedex[id];

      if (entry) {
        entry.seenCount += 1;
        if (isCorrect) {
          entry.correctCount += 1;
        }
        entry.lastSeenAt = now;
        newPokedex[id] = entry;
      } else if (isCorrect) {
        newPokedex[id] = {
          id,
          name,
          common_name: preferred_common_name,
          iconic_taxon_id,
          ancestor_ids,
          seenCount: 1,
          correctCount: 1,
          thumbnail,
          lastSeenAt: now,
        };
      }
      
      return {
        ...prevProfile,
        pokedex: newPokedex,
      };
    });
  }, [updateProfile]);

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
    updatePokedex,
  };

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser() {
  const context = useContext(UserContext);
  if (!context) throw new Error('useUser must be used within a UserProvider');
  return context;
}
