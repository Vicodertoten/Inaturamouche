// server/services/lures-v2/QualityValidator.js
// Validation minimale de la qualité d'un set de lures

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
