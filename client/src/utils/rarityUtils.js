export const RARITY_TIERS = Object.freeze({
  LEGENDARY: 'legendary',
  EPIC: 'epic',
  RARE: 'rare',
  UNCOMMON: 'uncommon',
  COMMON: 'common',
  UNKNOWN: 'unknown',
});

const RARITY_RULES = [
  { tier: RARITY_TIERS.LEGENDARY, max: 1000, label: 'Legendaire', colorVar: '--rarity-legendary', bonusXp: 50 },
  { tier: RARITY_TIERS.EPIC, max: 10000, label: 'Epique', colorVar: '--rarity-epic', bonusXp: 25 },
  { tier: RARITY_TIERS.RARE, max: 50000, label: 'Rare', colorVar: '--rarity-rare', bonusXp: 10 },
  { tier: RARITY_TIERS.UNCOMMON, max: 100000, label: 'Peu commun', colorVar: '--rarity-uncommon', bonusXp: 5 },
  { tier: RARITY_TIERS.COMMON, max: Infinity, label: 'Commun', colorVar: '--rarity-common', bonusXp: 0 },
];

export function getRarityTier(observationsCount) {
  const normalized = Number(observationsCount);
  if (!Number.isFinite(normalized) || normalized < 0) return null;
  const rule = RARITY_RULES.find((entry) => normalized < entry.max);
  return rule ? rule.tier : RARITY_TIERS.COMMON;
}

export function getRarityInfo(observationsCount) {
  const normalized = Number(observationsCount);
  if (!Number.isFinite(normalized) || normalized < 0) {
    return {
      tier: RARITY_TIERS.UNKNOWN,
      label: 'Inconnue',
      colorVar: '--rarity-unknown',
      bonusXp: 0,
      observationsCount: null,
    };
  }
  const rule = RARITY_RULES.find((entry) => normalized < entry.max) || RARITY_RULES[RARITY_RULES.length - 1];
  return {
    tier: rule.tier,
    label: rule.label,
    colorVar: rule.colorVar,
    bonusXp: rule.bonusXp,
    observationsCount: normalized,
  };
}

export function getRarityInfoByTier(tier) {
  const rule = RARITY_RULES.find((entry) => entry.tier === tier);
  if (!rule) {
    return {
      tier: RARITY_TIERS.UNKNOWN,
      label: 'Inconnue',
      colorVar: '--rarity-unknown',
      bonusXp: 0,
      observationsCount: null,
    };
  }
  return {
    tier: rule.tier,
    label: rule.label,
    colorVar: rule.colorVar,
    bonusXp: rule.bonusXp,
    observationsCount: null,
  };
}

export function getRarityInfoForTaxon(taxon = {}) {
  const observationsCount =
    Number.isFinite(taxon?.observations_count) ? taxon.observations_count : null;
  if (observationsCount === null) {
    if (taxon?.rarity_tier) {
      return getRarityInfoByTier(taxon.rarity_tier);
    }
    return {
      tier: RARITY_TIERS.UNKNOWN,
      label: 'Inconnue',
      colorVar: '--rarity-unknown',
      bonusXp: 0,
      observationsCount: null,
    };
  }
  return getRarityInfo(observationsCount);
}
