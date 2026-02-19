import { listPublicPacks } from '../packs/index.js';

const LEVEL_WEIGHT = {
  beginner: 0,
  intermediate: 1,
  advanced: 2,
};

const REGION_KEYS = ['belgium', 'france', 'europe', 'world'];

const REGION_DISTANCE = {
  belgium: { belgium: 0, france: 1, europe: 2, world: 3 },
  france: { belgium: 1, france: 0, europe: 2, world: 3 },
  europe: { belgium: 1, france: 1, europe: 0, world: 2 },
  world: { belgium: 2, france: 2, europe: 1, world: 0 },
};

const SECTION_DEFINITIONS = [
  { id: 'starter', titleKey: 'home.section_starter' },
  { id: 'near_you', titleKey: 'home.section_near_you' },
  { id: 'explore', titleKey: 'home.section_explore' },
];

const DEFAULT_SECTION_LIMIT = 10;

const CUSTOM_ENTRY_FALLBACK = {
  id: 'custom',
  titleKey: 'home.custom_create_title',
  descriptionKey: 'home.custom_create_desc',
};

function normalizeRegion(region) {
  const normalized = String(region || '').toLowerCase().trim();
  return REGION_KEYS.includes(normalized) ? normalized : 'world';
}

function normalizeRecentPackIds(recentPackIds) {
  if (!Array.isArray(recentPackIds)) return [];
  return recentPackIds
    .map((id) => String(id || '').trim())
    .filter(Boolean)
    .slice(0, 12);
}

function getRegionDistance(packRegion, userRegion) {
  const from = normalizeRegion(userRegion);
  const to = normalizeRegion(packRegion);
  return REGION_DISTANCE[from]?.[to] ?? 2;
}

function scorePack(pack, {
  region,
  recentSet,
  sectionId,
  categoryCounts,
  regionCounts,
}) {
  const baseSortWeight = Number.isFinite(pack.sortWeight) ? pack.sortWeight : 9999;
  const regionDistance = getRegionDistance(pack.region, region);
  const levelWeight = LEVEL_WEIGHT[pack.level] ?? 1;
  const categoryRepeatPenalty = (categoryCounts.get(pack.category) || 0) * 24;
  const regionRepeatPenalty = (regionCounts.get(pack.region || 'world') || 0) * 10;
  const recentlyPlayedPenalty = recentSet.has(pack.id) ? 170 : 0;

  let score =
    baseSortWeight +
    regionDistance * 38 +
    levelWeight * 20 +
    categoryRepeatPenalty +
    regionRepeatPenalty +
    recentlyPlayedPenalty;

  if (sectionId === 'starter') {
    if (pack.category === 'starter') score -= 38;
    if (pack.level === 'beginner') score -= 24;
    if (pack.category === 'expert') score += 90;
  }

  if (sectionId === 'near_you') {
    score += regionDistance * 44;
    if (regionDistance === 0) score -= 40;
    if (pack.category === 'regional') score -= 10;
  }

  if (sectionId === 'explore') {
    if (pack.region === 'world') score -= 24;
    if (pack.category === 'world') score -= 14;
    if (pack.category === 'starter') score += 12;
  }

  return score;
}

function pickSectionPacks(candidates, {
  sectionId,
  region,
  recentSet,
  limit,
}) {
  const remaining = [...candidates];
  const selected = [];
  const categoryCounts = new Map();
  const regionCounts = new Map();

  while (remaining.length > 0 && selected.length < limit) {
    let bestIndex = -1;
    let bestScore = Number.POSITIVE_INFINITY;

    for (let i = 0; i < remaining.length; i += 1) {
      const candidate = remaining[i];
      const score = scorePack(candidate, {
        region,
        recentSet,
        sectionId,
        categoryCounts,
        regionCounts,
      });
      if (
        score < bestScore ||
        (score === bestScore && String(candidate.id).localeCompare(String(remaining[bestIndex]?.id || '')) < 0)
      ) {
        bestScore = score;
        bestIndex = i;
      }
    }

    if (bestIndex < 0) break;
    const [picked] = remaining.splice(bestIndex, 1);
    selected.push(picked);
    categoryCounts.set(picked.category, (categoryCounts.get(picked.category) || 0) + 1);
    regionCounts.set(picked.region || 'world', (regionCounts.get(picked.region || 'world') || 0) + 1);
  }

  return selected;
}

function withFallbackSectionPacks(basePacks, fallbackPool, limit) {
  if (basePacks.length >= limit) return basePacks.slice(0, limit);
  const merged = [...basePacks];
  for (const pack of fallbackPool) {
    if (merged.some((item) => item.id === pack.id)) continue;
    merged.push(pack);
    if (merged.length >= limit) break;
  }
  return merged;
}

function sanitizeSectionPacks(sectionPacks, sectionLimit) {
  return sectionPacks
    .filter(Boolean)
    .slice(0, sectionLimit)
    .map((pack) => ({
      ...pack,
      taxa_ids: Array.isArray(pack.taxa_ids) ? [...pack.taxa_ids] : undefined,
      api_params: pack.api_params ? { ...pack.api_params } : undefined,
    }));
}

/**
 * Build homepage pack sections from one shared ranking strategy.
 * The order is server-authoritative and deterministic.
 */
export function buildHomePackCatalog({
  region = 'world',
  recentPackIds = [],
  sectionLimit = DEFAULT_SECTION_LIMIT,
} = {}) {
  const safeRegion = normalizeRegion(region);
  const safeLimit = Number.isFinite(sectionLimit)
    ? Math.max(1, Math.min(24, Number(sectionLimit)))
    : DEFAULT_SECTION_LIMIT;

  const catalog = listPublicPacks();
  const customPack = catalog.find((pack) => pack.id === 'custom');
  const customEntry = {
    id: 'custom',
    titleKey: customPack?.titleKey || CUSTOM_ENTRY_FALLBACK.titleKey,
    descriptionKey: customPack?.descriptionKey || CUSTOM_ENTRY_FALLBACK.descriptionKey,
  };

  const eligibleHomePacks = catalog.filter(
    (pack) => pack.id !== 'custom' && pack.visibility === 'home'
  );
  const fallbackPool = [...eligibleHomePacks].sort((a, b) => {
    const delta = (a.sortWeight ?? 9999) - (b.sortWeight ?? 9999);
    if (delta !== 0) return delta;
    return String(a.id).localeCompare(String(b.id));
  });
  const recentSet = new Set(normalizeRecentPackIds(recentPackIds));
  const starterLimit = safeLimit;
  const nearLimit = safeLimit;
  const exploreLimit = safeLimit;

  const starterCandidates = eligibleHomePacks.filter(
    (pack) => pack.category === 'starter' || pack.level === 'beginner'
  );
  const starterPacks = withFallbackSectionPacks(
    pickSectionPacks(starterCandidates, {
      sectionId: 'starter',
      region: safeRegion,
      recentSet,
      limit: starterLimit,
    }),
    fallbackPool,
    starterLimit
  );

  const nearCandidates = eligibleHomePacks.filter(
    (pack) => getRegionDistance(pack.region, safeRegion) <= 1
  );
  const nearPacks = withFallbackSectionPacks(
    pickSectionPacks(nearCandidates, {
      sectionId: 'near_you',
      region: safeRegion,
      recentSet,
      limit: nearLimit,
    }),
    fallbackPool,
    nearLimit
  );

  const exploreCandidates = eligibleHomePacks;
  const explorePacks = withFallbackSectionPacks(
    pickSectionPacks(exploreCandidates, {
      sectionId: 'explore',
      region: safeRegion,
      recentSet,
      limit: exploreLimit,
    }),
    fallbackPool,
    exploreLimit
  );

  const sections = [
    { id: 'starter', titleKey: 'home.section_starter', packs: sanitizeSectionPacks(starterPacks, starterLimit) },
    { id: 'near_you', titleKey: 'home.section_near_you', packs: sanitizeSectionPacks(nearPacks, nearLimit) },
    { id: 'explore', titleKey: 'home.section_explore', packs: sanitizeSectionPacks(explorePacks, exploreLimit) },
  ];

  return {
    sections,
    customEntry,
  };
}

export function listSectionDefinitions() {
  return SECTION_DEFINITIONS.map((section) => ({ ...section }));
}

/**
 * Returns IDs aligned with homepage ranking, used by warmup jobs.
 */
export function getWarmupPackIds({ region = 'europe', limit = 4 } = {}) {
  const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(12, Number(limit))) : 4;
  const { sections } = buildHomePackCatalog({ region, sectionLimit: 6 });
  const orderedUnique = [];
  const seen = new Set();
  for (const section of sections) {
    for (const pack of section.packs) {
      if (seen.has(pack.id)) continue;
      seen.add(pack.id);
      orderedUnique.push(pack.id);
      if (orderedUnique.length >= safeLimit) return orderedUnique;
    }
  }
  return orderedUnique;
}

export default buildHomePackCatalog;
