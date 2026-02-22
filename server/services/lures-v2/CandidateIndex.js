// server/services/lures-v2/CandidateIndex.js
// Construction d'un index de candidats leurres pour une cible

import { lcaDepth } from '../../../lib/quiz-utils.js';

const MAX_CANDIDATES = 36;
const CROSS_ICONIC_PENALTY = 0.08;

function buildFallbackCandidates(pool, targetId, targetObservation) {
  const targetAnc = Array.isArray(targetObservation?.taxon?.ancestor_ids)
    ? targetObservation.taxon.ancestor_ids
    : [];
  const targetDepth = Math.max(targetAnc.length, 1);
  const targetIconic = targetObservation?.taxon?.iconic_taxon_id || null;

  const candidates = [];
  for (const taxonId of pool.taxonList || []) {
    const tid = String(taxonId);
    if (tid === targetId) continue;

    const list = pool.byTaxon.get(tid);
    if (!Array.isArray(list) || list.length === 0) continue;

    const representative = list[0];
    const anc = Array.isArray(representative?.taxon?.ancestor_ids)
      ? representative.taxon.ancestor_ids
      : [];
    const depth = lcaDepth(targetAnc, anc);
    const closeness = targetDepth > 0 ? depth / targetDepth : 0;

    const candidateIconic = representative?.taxon?.iconic_taxon_id || null;
    const crossIconic = Boolean(targetIconic && candidateIconic && targetIconic !== candidateIconic);
    const score = Math.max(0, closeness - (crossIconic ? CROSS_ICONIC_PENALTY : 0));

    candidates.push({
      tid,
      score,
      closeness,
      source: crossIconic ? 'lca+cross-iconic' : 'lca-fallback',
    });
  }

  candidates.sort((a, b) => b.score - a.score);
  return candidates.slice(0, MAX_CANDIDATES);
}

export function buildCandidateIndex(pool, targetTaxonId, targetObservation) {
  const targetId = String(targetTaxonId);
  const fromMap = pool?.confusionMap?.get(targetId);

  if (Array.isArray(fromMap) && fromMap.length > 0) {
    const normalized = fromMap
      .map((candidate) => ({
        tid: String(candidate.tid),
        score: Math.max(0, Number(candidate.score) || 0),
        closeness: Math.max(0, Math.min(1, Number(candidate.closeness) || 0)),
        source: candidate.source || 'confusion-map',
        obs: candidate.obs || null,
      }))
      .filter((candidate) => candidate.tid !== targetId)
      .sort((a, b) => b.score - a.score);

    return {
      source: 'confusion-map',
      candidates: normalized.slice(0, MAX_CANDIDATES),
    };
  }

  return {
    source: 'lca-fallback',
    candidates: buildFallbackCandidates(pool, targetId, targetObservation),
  };
}

export default buildCandidateIndex;
