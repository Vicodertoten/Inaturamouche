// server/services/lures-v2/QualityValidator.js
// Validation minimale de la qualité d'un set de lures

/**
 * Validate a set of selected lures before serving them.
 *
 * Checks: enough lures, no duplicates, none equals the target, all have
 * a resolved observation.
 *
 * @param {object} opts
 * @param {string} opts.targetTaxonId Target taxon ID.
 * @param {Array<{ taxonId: string, obs: object }>} opts.lures Selected lures.
 * @param {number} opts.expectedCount Required lure count.
 * @returns {{ ok: boolean, reason?: 'not_enough_lures'|'invalid_taxon_ids'|'duplicate_lures'|'missing_observation' }}
 */
export function validateLureSet({ targetTaxonId, lures, expectedCount }) {
  if (!Array.isArray(lures) || lures.length < expectedCount) {
    return { ok: false, reason: 'not_enough_lures' };
  }

  const targetId = String(targetTaxonId);
  const ids = lures.map((lure) => String(lure?.taxonId || ''));
  const unique = new Set(ids);

  if (ids.some((id) => !id || id === targetId)) {
    return { ok: false, reason: 'invalid_taxon_ids' };
  }

  if (unique.size !== ids.length) {
    return { ok: false, reason: 'duplicate_lures' };
  }

  const hasInvalidObs = lures.some((lure) => !lure?.obs || !lure?.obs?.taxon?.id);
  if (hasInvalidObs) {
    return { ok: false, reason: 'missing_observation' };
  }

  return { ok: true };
}

export default validateLureSet;
