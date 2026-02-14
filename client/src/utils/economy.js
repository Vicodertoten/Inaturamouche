export const HINT_XP_MULTIPLIER_PER_HINT = 0.85;
export const HINT_XP_MIN_MULTIPLIER = 0.6;
export const HINT_XP_PENALTY_PERCENT = Math.round((1 - HINT_XP_MULTIPLIER_PER_HINT) * 100);

const TAXON_REPEAT_XP_MULTIPLIERS = [1.0, 0.85, 0.7, 0.6];

export function computeTaxonRepeatMultiplier(repeatCount = 0) {
  const safeCount = Math.max(0, Number.parseInt(String(repeatCount), 10) || 0);
  return TAXON_REPEAT_XP_MULTIPLIERS[Math.min(safeCount, TAXON_REPEAT_XP_MULTIPLIERS.length - 1)];
}

export function computeHintXpMultiplier({ mode = 'easy', hintCount = 0 } = {}) {
  const safeHintCount = Math.max(0, Number.parseInt(String(hintCount), 10) || 0);
  if (safeHintCount === 0) return 1;

  // Riddle mode already encodes hint cost in round points (10 -> 5 -> 1).
  if (mode === 'riddle') return 1;

  const multiplier = Math.pow(HINT_XP_MULTIPLIER_PER_HINT, safeHintCount);
  return Math.max(HINT_XP_MIN_MULTIPLIER, multiplier);
}

export function computeRoundEconomy({
  isCorrect = false,
  points = 0,
  bonus = 0,
  streakBonus = 0,
  rarityBonusXp = 0,
  mode = 'easy',
  hintCount = 0,
  repeatCount = 0,
} = {}) {
  const scoreDelta = Math.max(0, Math.floor((points || 0) + (bonus || 0) + (streakBonus || 0)));
  const baseXp = isCorrect ? Math.max(0, scoreDelta + Math.floor(rarityBonusXp || 0)) : 0;
  const repeatXpMultiplier = computeTaxonRepeatMultiplier(repeatCount);
  const hintXpMultiplier = computeHintXpMultiplier({ mode, hintCount });
  const gameplayXpMultiplier = repeatXpMultiplier * hintXpMultiplier;
  const xpBeforeProfileMultipliers = Math.max(0, Math.floor(baseXp * gameplayXpMultiplier));

  return {
    scoreDelta,
    baseXp,
    repeatCount,
    repeatXpMultiplier,
    hintCount: Math.max(0, Number.parseInt(String(hintCount), 10) || 0),
    hintXpMultiplier,
    gameplayXpMultiplier,
    xpBeforeProfileMultipliers,
  };
}

