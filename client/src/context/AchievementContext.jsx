/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useRef, useState, useCallback } from 'react';

const AchievementContext = createContext(null);

export function AchievementProvider({ children }) {
  const [newlyUnlocked, setNewlyUnlocked] = useState([]);
  const achievementsTimerRef = useRef(null);

  const clearAchievementsTimer = useCallback(() => {
    if (achievementsTimerRef.current) {
      clearTimeout(achievementsTimerRef.current);
      achievementsTimerRef.current = null;
    }
  }, []);

  const clearUnlockedLater = useCallback(() => {
    clearAchievementsTimer();
    achievementsTimerRef.current = setTimeout(() => setNewlyUnlocked([]), 5000);
  }, [clearAchievementsTimer]);

  return (
    <AchievementContext.Provider
      value={{ newlyUnlocked, setNewlyUnlocked, clearAchievementsTimer, clearUnlockedLater }}
    >
      {children}
    </AchievementContext.Provider>
  );
}

export function useAchievement() {
  const ctx = useContext(AchievementContext);
  if (!ctx) throw new Error('useAchievement must be used within an AchievementProvider');
  return ctx;
}
