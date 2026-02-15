import { useMemo } from 'react';

/**
 * Maps the user's timezone / language to a sensible default pack.
 *
 * Strategy (zero network, instant):
 *  1. Read Intl.DateTimeFormat().resolvedOptions().timeZone  → "Europe/Paris"
 *  2. Read navigator.language                                → "fr-BE"
 *  3. Combine both signals to pick the best regional pack.
 *
 * The mapping intentionally favours broad, beginner-friendly packs
 * (birds, mushrooms, trees) over niche ones (herps, reef).
 */

const TIMEZONE_TO_PACK = {
  // France
  'Europe/Paris': 'france_mammals',
  // Belgium
  'Europe/Brussels': 'belgium_birds',
  // Netherlands, Germany, Austria, Switzerland → European trees/mushrooms
  'Europe/Amsterdam': 'european_trees',
  'Europe/Berlin': 'european_trees',
  'Europe/Vienna': 'european_mushrooms',
  'Europe/Zurich': 'european_mushrooms',
  // UK & Ireland
  'Europe/London': 'world_birds',
  'Europe/Dublin': 'world_birds',
  // Scandinavia
  'Europe/Stockholm': 'european_trees',
  'Europe/Oslo': 'european_trees',
  'Europe/Helsinki': 'european_trees',
  'Europe/Copenhagen': 'european_trees',
  // Southern Europe → Mediterranean flora
  'Europe/Madrid': 'mediterranean_flora',
  'Europe/Rome': 'mediterranean_flora',
  'Europe/Lisbon': 'mediterranean_flora',
  'Europe/Athens': 'mediterranean_flora',
  'Europe/Istanbul': 'mediterranean_flora',
};

// Broader fallback based on language subtag
const LANG_TO_PACK = {
  fr: 'france_mammals',
  nl: 'european_mushrooms',
  de: 'european_trees',
  it: 'mediterranean_flora',
  es: 'mediterranean_flora',
  pt: 'mediterranean_flora',
  en: 'world_birds',
};

// Map timezone / language to a region for pack sorting priority
const TIMEZONE_TO_REGION = {
  'Europe/Brussels': 'belgium',
  'Europe/Paris': 'france',
  'Europe/Amsterdam': 'europe',
  'Europe/Berlin': 'europe',
  'Europe/Vienna': 'europe',
  'Europe/Zurich': 'europe',
  'Europe/London': 'europe',
  'Europe/Dublin': 'europe',
  'Europe/Stockholm': 'europe',
  'Europe/Oslo': 'europe',
  'Europe/Helsinki': 'europe',
  'Europe/Copenhagen': 'europe',
  'Europe/Madrid': 'europe',
  'Europe/Rome': 'europe',
  'Europe/Lisbon': 'europe',
  'Europe/Athens': 'europe',
  'Europe/Istanbul': 'europe',
};

const LANG_TO_REGION = {
  fr: 'france',
  nl: 'belgium',
  de: 'europe',
  it: 'europe',
  es: 'europe',
  pt: 'europe',
  en: 'world',
};

/**
 * Detects the user's region from timezone / browser language.
 * @returns {string} region key (belgium, france, europe, world, oceania)
 */
export function detectRegion() {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz && TIMEZONE_TO_REGION[tz]) return TIMEZONE_TO_REGION[tz];
    if (tz?.startsWith('Europe/')) return 'europe';
    const lang = (navigator.language || '').split('-')[0].toLowerCase();
    if (lang && LANG_TO_REGION[lang]) return LANG_TO_REGION[lang];
  } catch {
    // safe fallback
  }
  return 'world';
}

function detectBestPack() {
  try {
    // 1. Try timezone
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz && TIMEZONE_TO_PACK[tz]) {
      return TIMEZONE_TO_PACK[tz];
    }

    // 2. Try broader timezone region (e.g. "Europe/…" → european trees)
    if (tz?.startsWith('Europe/')) return 'european_trees';
    if (tz?.startsWith('America/')) return 'world_birds';
    if (tz?.startsWith('Asia/')) return 'world_birds';
    if (tz?.startsWith('Africa/')) return 'world_birds';

    // 3. Fallback: navigator language
    const lang = (navigator.language || '').split('-')[0].toLowerCase();
    if (lang && LANG_TO_PACK[lang]) {
      return LANG_TO_PACK[lang];
    }
  } catch {
    // Intl not available — safe fallback
  }

  return 'world_birds'; // universal fallback
}

/**
 * Returns the recommended default pack ID for a new user,
 * based on their timezone and browser language.
 *
 * @returns {string} pack ID
 */
export function useGeoDefaultPack() {
  return useMemo(() => detectBestPack(), []);
}

/**
 * Returns the detected region string for pack sorting.
 * @returns {string}
 */
export function useDetectedRegion() {
  return useMemo(() => detectRegion(), []);
}
