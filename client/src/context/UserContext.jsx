import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { loadProfileWithDefaults, saveProfile } from '../services/PlayerProfile';

const UserContext = createContext(null);

export function UserProvider({ children }) {
  const [profile, setProfile] = useState(() => loadProfileWithDefaults());
  const [language, setLanguage] = useState(() => localStorage.getItem('inaturamouche_lang') || 'fr');
  const [achievementQueue, setAchievementQueue] = useState([]);

  useEffect(() => {
    localStorage.setItem('inaturamouche_lang', language);
  }, [language]);

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
    language,
    setLanguage,
    achievementQueue,
    queueAchievements,
    popAchievement,
  };

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser() {
  const context = useContext(UserContext);
  if (!context) throw new Error('useUser must be used within a UserProvider');
  return context;
}

