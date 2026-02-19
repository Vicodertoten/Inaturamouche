import { useMemo } from 'react';

const TIMEZONE_TO_PACK = {
  'Europe/Brussels': 'belgium_starter_mix',
  'Europe/Paris': 'europe_birds',
  'Europe/Amsterdam': 'europe_birds',
  'Europe/Berlin': 'europe_birds',
  'Europe/Vienna': 'europe_birds',
  'Europe/Zurich': 'europe_birds',
  'Europe/London': 'europe_birds',
  'Europe/Dublin': 'europe_birds',
  'Europe/Stockholm': 'europe_birds',
  'Europe/Oslo': 'europe_birds',
  'Europe/Helsinki': 'europe_birds',
  'Europe/Copenhagen': 'europe_birds',
  'Europe/Madrid': 'europe_plants',
  'Europe/Rome': 'europe_plants',
  'Europe/Lisbon': 'europe_plants',
  'Europe/Athens': 'europe_plants',
  'Europe/Istanbul': 'europe_plants',
};

const LANG_TO_PACK = {
  fr: 'europe_birds',
  nl: 'belgium_starter_mix',
  de: 'europe_birds',
  it: 'europe_plants',
  es: 'europe_plants',
  pt: 'europe_plants',
  en: 'world_birds',
};

const TIMEZONE_TO_REGION = {
  'Europe/Brussels': 'belgium',
  'Europe/Paris': 'europe',
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
  fr: 'europe',
  nl: 'belgium',
  de: 'europe',
  it: 'europe',
  es: 'europe',
  pt: 'europe',
  en: 'world',
};

function getResolvedTimezone() {
  try {
    const dateTimeFormat = globalThis.Intl?.DateTimeFormat;
    if (typeof dateTimeFormat !== 'function') return '';
    return dateTimeFormat().resolvedOptions().timeZone || '';
  } catch {
    return '';
  }
}

/**
 * Detects region priority from timezone then browser language, with world fallback.
 * @returns {'belgium'|'france'|'europe'|'world'}
 */
export function detectRegion() {
  try {
    const tz = getResolvedTimezone();
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
    const tz = getResolvedTimezone();
    if (tz && TIMEZONE_TO_PACK[tz]) {
      return TIMEZONE_TO_PACK[tz];
    }

    if (tz?.startsWith('Europe/')) return 'europe_birds';

    const lang = (navigator.language || '').split('-')[0].toLowerCase();
    if (lang && LANG_TO_PACK[lang]) {
      return LANG_TO_PACK[lang];
    }
  } catch {
    // safe fallback
  }

  return 'world_birds';
}

export function useGeoDefaultPack() {
  return useMemo(() => detectBestPack(), []);
}

export function useDetectedRegion() {
  return useMemo(() => detectRegion(), []);
}
