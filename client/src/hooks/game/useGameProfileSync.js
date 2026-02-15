import { useEffect } from 'react';

export function useGameProfileSync({ profile, setHasPermanentShield, setInitialSessionXP }) {
  useEffect(() => {
    if (profile) {
      setHasPermanentShield(false);
      setInitialSessionXP(profile?.xp || 0);
    }
  }, [profile, setHasPermanentShield, setInitialSessionXP]);
}
