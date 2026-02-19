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

const DEFAULT_SECTION_LIMIT = null;

const CUSTOM_ENTRY_FALLBACK = {
  id: 'custom',
  titleKey: 'home.custom_create_title',
  descriptionKey: 'home.custom_create_desc',
};

function normalizeRegion(region) {
  const normalized = String(region || '').toLowerCase().trim();
  return REGION_KEYS.includes(normalized) ? normalized : 'world';
}

function normalizeOptionalRegion(region) {
  const normalized = String(region || '').toLowerCase().trim();
  return REGION_KEYS.includes(normalized) ? normalized : null;
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

function addCount(map, key) {
  map.set(key, (map.get(key) || 0) + 1);
}

function getTagRepeatPenalty(tags, tagCounts) {
  if (!Array.isArray(tags) || tags.length === 0) return 0;
  let penalty = 0;
  for (const tag of tags) {
    penalty += (tagCounts.get(tag) || 0) * 7;
  }
  return penalty;
}

function scorePack(pack, {
  region,
  sectionId,
  categoryCounts,
  regionCounts,
  themeCounts,
  tagCounts,
  recentOrderMap,
}) {
  const baseSortWeight = Number.isFinite(pack.sortWeight) ? pack.sortWeight : 9999;
  const regionDistance = getRegionDistance(pack.region, region);
  const levelWeight = LEVEL_WEIGHT[pack.level] ?? 1;

  const categoryRepeatPenalty = (categoryCounts.get(pack.category) || 0) * 22;
  const regionRepeatPenalty = (regionCounts.get(pack.region || 'world') || 0) * 10;
  const themeRepeatPenalty = (themeCounts.get(pack.theme || 'unthemed') || 0) * 20;
  const tagRepeatPenalty = getTagRepeatPenalty(pack.tags, tagCounts);

  const recentIndex = recentOrderMap.get(pack.id);
  const recentlyPlayedPenalty = Number.isFinite(recentIndex)
    ? Math.max(80, 210 - recentIndex * 18)
    : 0;

  let score =
    baseSortWeight +
    regionDistance * 36 +
    levelWeight * 16 +
    categoryRepeatPenalty +
    regionRepeatPenalty +
    themeRepeatPenalty +
    tagRepeatPenalty +
    recentlyPlayedPenalty;

  if (sectionId === 'starter') {
    if (pack.category === 'starter') score -= 38;
    if (pack.level === 'beginner') score -= 20;
    // Keep regional packs available for the dedicated near-you rail.
    if (pack.category === 'regional') score += 56;
    if (pack.category === 'expert') score += 80;
  }

  if (sectionId === 'near_you') {
    score += regionDistance * 42;
    if (regionDistance === 0) score -= 38;
    if (pack.category === 'regional') score -= 8;
    if (pack.category === 'threatened') score -= 6;
  }

  if (sectionId === 'explore') {
    if (pack.region === 'world') score -= 22;
    if (pack.category === 'world') score -= 14;
    if (pack.category === 'starter') score += 16;
  }

  return score;
}

function pickSectionPacks(candidates, {
  sectionId,
  region,
  limit,
  blockedIds,
  recentOrderMap,
}) {
  const remaining = candidates.filter((pack) => !blockedIds.has(pack.id));
  const selected = [];
  const categoryCounts = new Map();
  const regionCounts = new Map();
  const themeCounts = new Map();
  const tagCounts = new Map();

  while (remaining.length > 0 && selected.length < limit) {
    let bestIndex = -1;
    let bestScore = Number.POSITIVE_INFINITY;

    for (let i = 0; i < remaining.length; i += 1) {
      const candidate = remaining[i];
      const score = scorePack(candidate, {
        region,
        sectionId,
        categoryCounts,
        regionCounts,
        themeCounts,
        tagCounts,
        recentOrderMap,
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
    addCount(categoryCounts, picked.category);
    addCount(regionCounts, picked.region || 'world');
    addCount(themeCounts, picked.theme || 'unthemed');
    if (Array.isArray(picked.tags)) {
      for (const tag of picked.tags) addCount(tagCounts, tag);
    }
  }

  return selected;
}

function withFallbackSectionPacks(basePacks, fallbackPool, limit, { blockedIds }) {
  if (basePacks.length >= limit) return basePacks.slice(0, limit);

  const merged = [...basePacks];
  const mergedIds = new Set(merged.map((pack) => pack.id));

  for (const pack of fallbackPool) {
    if (mergedIds.has(pack.id)) continue;
    if (blockedIds.has(pack.id)) continue;
    merged.push(pack);
    mergedIds.add(pack.id);
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
      tags: Array.isArray(pack.tags) ? [...pack.tags] : undefined,
      api_params: pack.api_params ? { ...pack.api_params } : undefined,
    }));
}

/**
 * Build homepage pack sections from one shared ranking strategy.
 * The order is server-authoritative and deterministic.
 */
export function buildHomePackCatalog({
  region = 'world',
  regionOverride,
  recentPackIds = [],
  sectionLimit = DEFAULT_SECTION_LIMIT,
} = {}) {
  const safeRegion = normalizeOptionalRegion(regionOverride) || normalizeRegion(region);
  const requestedLimit = Number.isFinite(sectionLimit)
    ? Math.max(1, Number(sectionLimit))
    : null;

  const catalog = listPublicPacks();
  const customPack = catalog.find((pack) => pack.id === 'custom');
  const customEntry = {
    id: 'custom',
    titleKey: customPack?.titleKey || CUSTOM_ENTRY_FALLBACK.titleKey,
    descriptionKey: customPack?.descriptionKey || CUSTOM_ENTRY_FALLBACK.descriptionKey,
  };

  const eligibleHomePacks = catalog.filter(
    (pack) => pack.id !== 'custom' && pack.visibility !== 'legacy'
  );
  const safeLimit = requestedLimit
    ? Math.min(requestedLimit, Math.max(1, eligibleHomePacks.length))
    : Math.max(1, eligibleHomePacks.length);

  const fallbackPool = [...eligibleHomePacks].sort((a, b) => {
    const delta = (a.sortWeight ?? 9999) - (b.sortWeight ?? 9999);
    if (delta !== 0) return delta;
    return String(a.id).localeCompare(String(b.id));
  });

  const recentOrderMap = new Map(
    normalizeRecentPackIds(recentPackIds).map((id, index) => [id, index])
  );

  const blockedIds = new Set();
  const starterSoftCap = Math.max(3, Math.ceil(eligibleHomePacks.length * 0.35));
  const starterLimit = Math.min(safeLimit, starterSoftCap);

  const starterCandidates = eligibleHomePacks.filter(
    (pack) => pack.category === 'starter' || (pack.category === 'world' && pack.level === 'beginner')
  );
  const starterPacks = withFallbackSectionPacks(
    pickSectionPacks(starterCandidates, {
      sectionId: 'starter',
      region: safeRegion,
      limit: starterLimit,
      blockedIds,
      recentOrderMap,
    }),
    fallbackPool,
    starterLimit,
    { blockedIds }
  );
  for (const pack of starterPacks) blockedIds.add(pack.id);

  const nearCandidatesPrimary = eligibleHomePacks.filter(
    (pack) => getRegionDistance(pack.region, safeRegion) <= 1
  );
  const nearCandidates = nearCandidatesPrimary.length >= Math.min(3, safeLimit)
    ? nearCandidatesPrimary
    : eligibleHomePacks.filter((pack) => getRegionDistance(pack.region, safeRegion) <= 2);
  const remainingAfterStarter = Math.max(0, eligibleHomePacks.length - starterPacks.length);
  const nearSoftCap = Math.max(3, Math.ceil(remainingAfterStarter * 0.6));
  const nearLimit = Math.min(safeLimit, nearSoftCap);

  const nearPacks = withFallbackSectionPacks(
    pickSectionPacks(nearCandidates, {
      sectionId: 'near_you',
      region: safeRegion,
      limit: nearLimit,
      blockedIds,
      recentOrderMap,
    }),
    fallbackPool,
    nearLimit,
    { blockedIds }
  );
  for (const pack of nearPacks) blockedIds.add(pack.id);

  const explorePacks = withFallbackSectionPacks(
    pickSectionPacks(eligibleHomePacks, {
      sectionId: 'explore',
      region: safeRegion,
      limit: safeLimit,
      blockedIds,
      recentOrderMap,
    }),
    fallbackPool,
    safeLimit,
    { blockedIds }
  );

  const sections = [
    { id: 'starter', titleKey: 'home.section_starter', packs: sanitizeSectionPacks(starterPacks, safeLimit) },
    { id: 'near_you', titleKey: 'home.section_near_you', packs: sanitizeSectionPacks(nearPacks, safeLimit) },
    { id: 'explore', titleKey: 'home.section_explore', packs: sanitizeSectionPacks(explorePacks, safeLimit) },
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
