export function buildCacheKey(obj) {
  return Object.keys(obj || {})
    .sort()
    .map((key) => {
      const value = obj[key];
      return `${key}=${Array.isArray(value) ? value.join(",") : value}`;
    })
    .join("|");
}

export function shuffleFisherYates(arr) {
  const copy = Array.isArray(arr) ? arr.slice() : [];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function lcaDepth(ancA = [], ancB = []) {
  const len = Math.min(ancA.length, ancB.length);
  let i = 0;
  while (i < len && ancA[i] === ancB[i]) i++;
  return i;
}

/**
 * Computes the effective cooldown length to avoid repeating target taxa too frequently.
 * - Caps the cooldown to the available unique taxa minus the number of choices to avoid deadlocks.
 * - Returns 0 if baseN is non-positive or invalid.
 *
 * @param {number} baseN Desired cooldown depth (questions before a taxon can reappear).
 * @param {number} taxonListLen Number of unique taxa available in the current pool.
 * @param {number} quizChoices Number of answer slots (used to preserve enough taxa for one question).
 * @returns {number} Effective cooldown length respecting pool capacity.
 */
export function effectiveCooldownN(baseN, taxonListLen, quizChoices) {
  if (!Number.isFinite(baseN) || baseN <= 0) return 0;
  const cap = Math.max(0, (taxonListLen || 0) - (quizChoices || 0));
  return Math.max(0, Math.min(baseN, cap));
}
