import { useMemo } from 'react';
import { getLevelFromXp, getXpForLevel } from '../utils/scoring';

/**
 * Hook pour calculer la progression XP d'un joueur
 * @param {number} currentXP - XP total actuel du joueur
 * @returns {Object} Informations de progression
 * @returns {number} level - Niveau actuel du joueur
 * @returns {number} nextLevel - Prochain niveau
 * @returns {number} xpForCurrentLevel - XP requis pour le niveau actuel
 * @returns {number} xpForNextLevel - XP requis pour le prochain niveau
 * @returns {number} xpProgress - XP accumulé dans le niveau actuel
 * @returns {number} xpNeeded - XP nécessaire pour passer au prochain niveau
 * @returns {number} progressPercent - Pourcentage de progression (0-100)
 */
export const useLevelProgress = (currentXP = 0) => {
  return useMemo(() => {
    const safeXP = Math.max(0, currentXP || 0);
    
    // Niveau actuel
    const level = getLevelFromXp(safeXP);
    const nextLevel = level + 1;
    
    // XP requis pour chaque niveau
    const xpForCurrentLevel = getXpForLevel(level);
    const xpForNextLevel = getXpForLevel(nextLevel);
    
    // Progression dans le niveau actuel
    const xpProgress = safeXP - xpForCurrentLevel;
    const xpNeeded = xpForNextLevel - xpForCurrentLevel;
    
    // Pourcentage de progression
    const progressPercent = xpNeeded > 0 
      ? Math.min(100, Math.max(0, (xpProgress / xpNeeded) * 100))
      : 100;
    
    return {
      level,
      nextLevel,
      xpForCurrentLevel,
      xpForNextLevel,
      xpProgress,
      xpNeeded,
      progressPercent: Math.round(progressPercent * 100) / 100, // Arrondi à 2 décimales
    };
  }, [currentXP]);
};
