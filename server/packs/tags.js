export const PACK_TAGS = Object.freeze({
  THREATENED: 'threatened',
  EDIBLE: 'edible',
  TOXIC: 'toxic',
  MEDICINAL: 'medicinal',
  INVASIVE: 'invasive',
  FUN: 'fun',
  SEASONAL: 'seasonal',
  LOOKALIKE: 'lookalike',
});

const KNOWN_TAGS = new Set(Object.values(PACK_TAGS));

export function normalizePackTags(tags) {
  if (!Array.isArray(tags)) return undefined;

  const normalized = [];
  const seen = new Set();

  for (const tag of tags) {
    const value = String(tag || '').trim().toLowerCase();
    if (!KNOWN_TAGS.has(value)) continue;
    if (seen.has(value)) continue;
    seen.add(value);
    normalized.push(value);
  }

  return normalized.length > 0 ? normalized : undefined;
}

export function isKnownPackTag(tag) {
  return KNOWN_TAGS.has(String(tag || '').trim().toLowerCase());
}
