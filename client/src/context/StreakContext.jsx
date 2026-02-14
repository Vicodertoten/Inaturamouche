/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState } from 'react';

const StreakContext = createContext(null);

export function StreakProvider({ children }) {
  const [currentStreak, setCurrentStreak] = useState(0);
  const [longestStreak, setLongestStreak] = useState(0);
  const [inGameShields, setInGameShields] = useState(0);
  const [hasPermanentShield, setHasPermanentShield] = useState(false);

  return (
    <StreakContext.Provider
      value={{
        currentStreak,
        setCurrentStreak,
        longestStreak,
        setLongestStreak,
        inGameShields,
        setInGameShields,
        hasPermanentShield,
        setHasPermanentShield,
      }}
    >
      {children}
    </StreakContext.Provider>
  );
}

export function useStreak() {
  const ctx = useContext(StreakContext);
  if (!ctx) throw new Error('useStreak must be used within a StreakProvider');
  return ctx;
}
