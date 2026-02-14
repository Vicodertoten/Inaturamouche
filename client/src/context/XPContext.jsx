/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useCallback } from 'react';
import { calculatePermanentMultiplier } from '../core/achievements';

const XPContext = createContext(null);

export function XPProvider({ children }) {
  const [recentXPGain, setRecentXPGain] = useState(0);
  const [initialSessionXP, setInitialSessionXP] = useState(0);
  const [levelUpNotification, setLevelUpNotification] = useState(null);

  /**
   * Calcule tous les multiplicateurs XP applicables
   * @param {Object} profile - Profil joueur
   * @param {number} currentWinStreak - Streak de victoires en cours
   * @param {Object} taxonData - Données du taxon pour multiplicateurs permanents
   * @returns {{dailyStreakBonus, winStreakBonus, timerBonus, permanentBonus, totalMultiplier}}
   */
  const calculateXPMultipliers = useCallback((profile, currentWinStreak = 0, taxonData = null) => {
    if (!profile) {
      return {
        dailyStreakBonus: 0,
        winStreakBonus: 0,
        timerBonus: 0,
        permanentBonus: 0,
        totalMultiplier: 1.0,
      };
    }

    // Daily streak bonus: +3% par jour, max 20%
    const dailyStreakCount = profile.dailyStreak?.current || 0;
    const dailyStreakBonus = Math.min(0.2, dailyStreakCount * 0.03);
    
    // Win streak bonus: +5% par victoire, max 50%
    const winStreakBonus = Math.min(0.5, currentWinStreak * 0.05);
    
    // Timer bonus (réservé pour future implémentation)
    const timerBonus = 0;
    
    // Multiplicateurs permanents des succès
    const permanentMultiplier = calculatePermanentMultiplier(profile.rewards, taxonData);
    const permanentBonus = permanentMultiplier - 1.0;
    
    // Total: additionner tous les bonus
    const totalMultiplier = 1.0 + dailyStreakBonus + winStreakBonus + timerBonus + permanentBonus;

    return {
      dailyStreakBonus,
      winStreakBonus,
      timerBonus,
      permanentBonus,
      totalMultiplier,
    };
  }, []);

  /**
   * Calcule l'XP avec tous les multiplicateurs appliqués
   * @param {number} baseXP - XP de base
   * @param {Object} profile - Profil joueur
   * @param {number} currentWinStreak - Streak actuelle
   * @param {Object} taxonData - Données du taxon (optionnel)
   * @returns {{earnedXP: number, multipliers: Object}}
   */
  const calculateFinalXP = useCallback((baseXP, profile, currentWinStreak = 0, taxonData = null) => {
    const multipliers = calculateXPMultipliers(profile, currentWinStreak, taxonData);
    const earnedXP = Math.floor(baseXP * multipliers.totalMultiplier);
    return { earnedXP, multipliers };
  }, [calculateXPMultipliers]);

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
        calculateFinalXP,
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
