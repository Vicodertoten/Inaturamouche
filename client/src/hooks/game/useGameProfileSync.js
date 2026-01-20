import { useEffect } from 'react';

export function useGameProfileSync({ profile, setHasPermanentShield, setInitialSessionXP }) {
  useEffect(() => {
    if (profile) {
      setHasPermanentShield(profile?.achievements?.includes('STREAK_GUARDIAN') || false);
      setInitialSessionXP(profile?.xp || 0);
    }
  }, [profile, setHasPermanentShield, setInitialSessionXP]);
}
