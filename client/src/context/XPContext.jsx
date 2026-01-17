import { createContext, useContext, useState } from 'react';

const XPContext = createContext(null);

export function XPProvider({ children }) {
  const [recentXPGain, setRecentXPGain] = useState(0);
  const [initialSessionXP, setInitialSessionXP] = useState(0);
  const [levelUpNotification, setLevelUpNotification] = useState(null);

  const calculateXPMultipliers = (profile, currentWinStreak = 0) => {
    if (!profile) {
      return {
        dailyStreakBonus: 0,
        winStreakBonus: 0,
        timerBonus: 0,
        totalMultiplier: 1.0,
      };
    }

    const dailyStreakCount = profile.dailyStreak?.current || 0;
    const dailyStreakBonus = Math.min(0.2, dailyStreakCount * 0.03);
    const winStreakBonus = Math.min(0.5, currentWinStreak * 0.05);
    const timerBonus = 0;
    const totalMultiplier = 1.0 + dailyStreakBonus + winStreakBonus + timerBonus;

    return {
      dailyStreakBonus,
      winStreakBonus,
      timerBonus,
      totalMultiplier,
    };
  };

  return (
    <XPContext.Provider
      value={{
        recentXPGain,
        setRecentXPGain,
        initialSessionXP,
        setInitialSessionXP,
        levelUpNotification,
        setLevelUpNotification,
        calculateXPMultipliers,
      }}
    >
      {children}
    </XPContext.Provider>
  );
}

export function useXP() {
  const ctx = useContext(XPContext);
  if (!ctx) throw new Error('useXP must be used within an XPProvider');
  return ctx;
}
