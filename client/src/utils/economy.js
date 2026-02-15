/**
 * Simplified round economy.
 * XP = score. No more hint/repeat multiplier layers.
 * Breakdown: base points + streak bonus + rarity bonus = XP.
 */

export function computeRoundEconomy({
  isCorrect = false,
  points = 0,
  bonus = 0,
  streakBonus = 0,
  rarityBonusXp = 0,
} = {}) {
  const scoreDelta = Math.max(0, Math.floor((points || 0) + (bonus || 0) + (streakBonus || 0)));
  const rarityBonus = isCorrect ? Math.max(0, Math.floor(rarityBonusXp || 0)) : 0;
  // XP = score delta + rarity bonus (no multiplier layers)
  const xp = isCorrect ? scoreDelta + rarityBonus : 0;

  return {
    scoreDelta,
    baseXp: isCorrect ? Math.floor((points || 0) + (bonus || 0)) : 0,
    streakBonus: isCorrect ? Math.floor(streakBonus || 0) : 0,
    rarityBonus,
    xp,
  };
}

