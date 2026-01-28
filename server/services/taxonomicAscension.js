import { shuffleFisherYates } from '../../lib/quiz-utils.js';
import { getFullTaxaDetails, getTaxonName } from './iNaturalistClient.js';

const RANK_ORDER = ['kingdom', 'phylum', 'class', 'order', 'family', 'genus', 'species'];
const MAX_OPTIONS_PER_RANK = 4;
const MAX_SPECIES_CANDIDATES = 4;
const MAX_SPECIES_OPTIONS = 4;
const MAX_ANCESTOR_ENRICH_TAXA = 32;

export const TAXONOMIC_MAX_MISTAKES = 2;
export const TAXONOMIC_HINT_COST_XP = 15;

const toRankKey = (value) => (typeof value === 'string' ? value.toLowerCase() : '');

const getClosestParentRank = (rank, lineage) => {
  const currentIdx = RANK_ORDER.indexOf(rank);
  for (let idx = currentIdx - 1; idx >= 0; idx -= 1) {
    const parentRank = RANK_ORDER[idx];
    if (lineage[parentRank]) return parentRank;
  }
  return null;
};

const extractAncestorsFromObservation = (obs) =>
  Array.isArray(obs?.taxon?.ancestors) ? obs.taxon.ancestors : [];

const shuffleTaxa = (taxa, rng) => {
  const arr = Array.isArray(taxa) ? [...taxa] : [];
  shuffleFisherYates(arr, rng);
  return arr;
};

const collectAncestorCandidates = ({
  pool,
  rank,
  correctId,
  parentId,
  parentRank,
  targetTaxonId,
  rng,
  maxCandidates,
  requireParent,
  taxonDetailsById,
}) => {
  const candidates = [];
  const seen = new Set();
  const taxonIds = shuffleTaxa(pool.taxonList || [], rng);

  for (const taxonId of taxonIds) {
    if (candidates.length >= maxCandidates) break;
    if (String(taxonId) === String(targetTaxonId)) continue;
    const sanitizedObs = pool.byTaxon.get(String(taxonId))?.[0];
    if (!sanitizedObs) continue;
    const detailAncestors = taxonDetailsById?.get(String(taxonId))?.ancestors;
    const ancestors =
      Array.isArray(detailAncestors) && detailAncestors.length > 0
        ? detailAncestors
        : extractAncestorsFromObservation(sanitizedObs);
    if (!ancestors.length) continue;
    if (requireParent && parentId) {
      const parentMatch = ancestors.some(
        (ancestor) => ancestor.id === parentId && toRankKey(ancestor.rank) === parentRank
      );
      if (!parentMatch) continue;
    }
    const candidateAncestor = ancestors.find((ancestor) => toRankKey(ancestor.rank) === rank);
    if (!candidateAncestor) continue;
    const candidateId = String(candidateAncestor.id);
    if (candidateId === String(correctId) || seen.has(candidateId)) continue;
    seen.add(candidateId);
    candidates.push({
      id: candidateId,
      snapshot: {
        id: candidateAncestor.id,
        name: candidateAncestor.name,
        preferred_common_name: candidateAncestor.preferred_common_name,
        rank: candidateAncestor.rank,
      },
    });
  }

  return candidates;
};

const gatherSpeciesCandidates = ({
  pool,
  targetTaxonId,
  targetLineage,
  rng,
  maxCandidates,
}) => {
  const candidates = [];
  const seen = new Set();
  const taxonIds = shuffleTaxa(pool.taxonList || [], rng);
  const parentRanks = ['genus', 'family', 'order', 'class', 'phylum', 'kingdom'];

  const appendCandidates = (parentRank, parentId, limit) => {
    for (const taxonId of taxonIds) {
      if (candidates.length >= limit) break;
      if (String(taxonId) === String(targetTaxonId) || seen.has(String(taxonId))) continue;
      const sanitizedObs = pool.byTaxon.get(String(taxonId))?.[0];
      if (!sanitizedObs) continue;
      if (parentId) {
        const parentMatch = extractAncestorsFromObservation(sanitizedObs).some(
          (ancestor) => ancestor.id === parentId && toRankKey(ancestor.rank) === parentRank
        );
        if (!parentMatch) continue;
      }
      seen.add(String(taxonId));
      candidates.push({
        id: String(taxonId),
        fallback: sanitizedObs.taxon,
      });
      if (candidates.length >= limit) break;
    }
  };

  for (const rank of parentRanks) {
    if (candidates.length >= maxCandidates) break;
    const parent = targetLineage[rank];
    if (!parent?.id) continue;
    appendCandidates(rank, parent.id, maxCandidates);
  }

  if (candidates.length < maxCandidates) {
    appendCandidates(null, null, maxCandidates);
  }

  return candidates.slice(0, maxCandidates);
};

const buildFallbackDetailsForAncestors = (ancestors, map) => {
  ancestors.forEach((ancestor) => {
    if (ancestor?.id) {
      const key = String(ancestor.id);
      if (!map.has(key)) {
        map.set(key, {
          id: ancestor.id,
          name: ancestor.name,
          preferred_common_name: ancestor.preferred_common_name,
          rank: ancestor.rank,
        });
      }
    }
  });
};

const buildFallbackDetailsForSpecies = (speciesList, map) => {
  speciesList.forEach((specie) => {
    const taxon = specie.fallback;
    if (taxon?.id) {
      const key = String(taxon.id);
      if (!map.has(key)) {
        map.set(key, {
          id: taxon.id,
          name: taxon.name,
          preferred_common_name: taxon.preferred_common_name,
          rank: taxon.rank,
          ancestor_ids: taxon.ancestor_ids,
          ancestors: taxon.ancestors,
        });
      }
    }
  });
};

const addAncestorsToPool = (result, seen, ancestors) => {
  if (!Array.isArray(ancestors)) return;
  ancestors.forEach((ancestor) => {
    const rank = toRankKey(ancestor.rank);
    if (!rank || !RANK_ORDER.includes(rank)) return;
    const key = `${rank}:${ancestor.id}`;
    if (seen.has(key)) return;
    seen.add(key);
    if (!result.has(rank)) result.set(rank, []);
    result.get(rank).push({
      id: ancestor.id,
      snapshot: {
        id: ancestor.id,
        name: ancestor.name,
        preferred_common_name: ancestor.preferred_common_name,
        rank: ancestor.rank,
      },
    });
  });
};

const buildAncestorPool = (pool, targetTaxonId, rng, extraTaxaDetails = []) => {
  const result = new Map();
  const seen = new Set();
  const taxonEntries = shuffleTaxa(Array.from(pool.byTaxon.entries()), rng);
  for (const [taxonId, observations] of taxonEntries) {
    if (String(taxonId) === String(targetTaxonId)) continue;
    const obs = observations?.[0];
    if (!obs) continue;
    addAncestorsToPool(result, seen, extractAncestorsFromObservation(obs));
  }

  const detailEntries = shuffleTaxa(extraTaxaDetails, rng);
  for (const detail of detailEntries) {
    if (!detail?.id) continue;
    if (String(detail.id) === String(targetTaxonId)) continue;
    addAncestorsToPool(result, seen, detail.ancestors);
  }
  return result;
};

const buildSpeciesAncestorPool = (speciesCandidates, taxonDetailsById) => {
  const pool = new Map();
  speciesCandidates.forEach((candidate) => {
    const detail = taxonDetailsById?.get(String(candidate.id));
    const ancestors =
      Array.isArray(detail?.ancestors) && detail.ancestors.length > 0
        ? detail.ancestors
        : Array.isArray(candidate?.fallback?.ancestors)
          ? candidate.fallback.ancestors
          : [];
    ancestors.forEach((ancestor) => {
      const rank = toRankKey(ancestor.rank);
      if (!rank || !RANK_ORDER.includes(rank)) return;
      if (!pool.has(rank)) pool.set(rank, []);
      pool.get(rank).push({
        id: ancestor.id,
        snapshot: {
          id: ancestor.id,
          name: ancestor.name,
          preferred_common_name: ancestor.preferred_common_name,
          rank: ancestor.rank,
        },
      });
    });
  });
  return pool;
};

const buildRankSteps = ({
  targetLineage,
  pool,
  targetTaxonId,
  rng,
  ancestorPool,
  speciesAncestorPool,
  taxonDetailsById,
}) => {
  const rankSteps = [];

  const targetRanks = RANK_ORDER.filter((rank) => targetLineage[rank]?.id);
  for (const rank of targetRanks) {
    const correctId = targetLineage[rank].id;
    const parentRank = getClosestParentRank(rank, targetLineage);
    const parentId = parentRank ? targetLineage[parentRank]?.id : null;
    const parentRankKey = parentRank ? parentRank : null;

    const primaryCandidates = collectAncestorCandidates({
      pool,
      rank,
      correctId,
      parentId,
      parentRank: parentRankKey,
      targetTaxonId,
      rng,
      maxCandidates: MAX_OPTIONS_PER_RANK - 1,
      requireParent: Boolean(parentId),
      taxonDetailsById,
    });

    const additionalCandidates = primaryCandidates.length < MAX_OPTIONS_PER_RANK - 1
      ? collectAncestorCandidates({
        pool,
        rank,
        correctId,
        parentId,
        parentRank: parentRankKey,
        targetTaxonId,
        rng,
        maxCandidates: (MAX_OPTIONS_PER_RANK - 1) - primaryCandidates.length,
        requireParent: false,
        taxonDetailsById,
      })
      : [];

    const combinedCandidates = [...primaryCandidates, ...additionalCandidates];
    const uniqueCandidates = [];
    const seenIds = new Set();
    combinedCandidates.forEach((candidate) => {
      if (seenIds.has(candidate.id)) return;
      seenIds.add(candidate.id);
      uniqueCandidates.push(candidate);
    });
    const limit = MAX_OPTIONS_PER_RANK - 1;
    const appendFromPool = (poolList) => {
      if (!Array.isArray(poolList)) return;
      for (const candidate of poolList) {
        if (uniqueCandidates.length >= limit) break;
        if (!candidate?.id) continue;
        const candidateId = String(candidate.id);
        if (candidateId === String(correctId) || seenIds.has(candidateId)) continue;
        seenIds.add(candidateId);
        uniqueCandidates.push(candidate);
      }
    };

    appendFromPool(ancestorPool?.get(rank));
    appendFromPool(speciesAncestorPool?.get(rank));

    rankSteps.push({
      rank,
      correctId,
      parentRank,
      parentId,
      distractorIds: uniqueCandidates.map((candidate) => candidate.id),
      distractorSnapshots: uniqueCandidates.map((candidate) => candidate.snapshot),
    });
  }

  return rankSteps;
};

export async function buildTaxonomicAscension({
  pool,
  targetTaxonId,
  locale,
  rng,
  logger,
  requestId,
  taxonDetailsCache,
}) {
  const targetDetailsList = await getFullTaxaDetails(
    [targetTaxonId],
    locale,
    { logger, requestId },
    taxonDetailsCache
  );
  const targetDetails = targetDetailsList[0];
  if (!targetDetails) {
    const err = new Error(`Impossible de récupérer les détails du taxon ${targetTaxonId}`);
    err.status = 502;
    throw err;
  }

  const targetLineage = {};
  if (Array.isArray(targetDetails.ancestors)) {
    targetDetails.ancestors.forEach((ancestor) => {
      const rank = toRankKey(ancestor.rank);
      if (rank && RANK_ORDER.includes(rank)) {
        targetLineage[rank] = ancestor;
      }
    });
  }
  targetLineage.species = {
    id: targetDetails.id,
    name: targetDetails.name,
    preferred_common_name: targetDetails.preferred_common_name,
    rank: 'species',
  };

  const speciesCandidates = gatherSpeciesCandidates({
    pool,
    targetTaxonId,
    targetLineage,
    rng,
    maxCandidates: MAX_SPECIES_CANDIDATES,
  });

  const enrichmentIds = new Set(speciesCandidates.map((candidate) => String(candidate.id)));
  const poolIds = shuffleTaxa(pool.taxonList || [], rng);
  for (const taxonId of poolIds) {
    if (enrichmentIds.size >= MAX_ANCESTOR_ENRICH_TAXA) break;
    if (String(taxonId) === String(targetTaxonId)) continue;
    enrichmentIds.add(String(taxonId));
  }

  const enrichmentFallbackDetails = new Map();
  enrichmentIds.forEach((id) => {
    const obs = pool.byTaxon.get(String(id))?.[0];
    if (obs?.taxon) enrichmentFallbackDetails.set(String(id), obs.taxon);
  });

  const enrichmentDetails = enrichmentIds.size
    ? await getFullTaxaDetails(
      Array.from(enrichmentIds),
      locale,
      { logger, requestId, fallbackDetails: enrichmentFallbackDetails },
      taxonDetailsCache
    )
    : [];
  const taxonDetailsById = new Map();
  taxonDetailsById.set(String(targetDetails.id), targetDetails);
  enrichmentDetails.forEach((detail) => {
    if (detail?.id != null) taxonDetailsById.set(String(detail.id), detail);
  });

  const ancestorPool = buildAncestorPool(pool, targetTaxonId, rng, enrichmentDetails);
  const speciesAncestorPool = buildSpeciesAncestorPool(speciesCandidates, taxonDetailsById);
  const rankSteps = buildRankSteps({
    targetLineage,
    pool,
    targetTaxonId,
    rng,
    ancestorPool,
    speciesAncestorPool,
    taxonDetailsById,
  });

  const detailIds = new Set();
  detailIds.add(String(targetDetails.id));
  const fallbackDetails = new Map();
  buildFallbackDetailsForAncestors(targetDetails.ancestors || [], fallbackDetails);
  fallbackDetails.set(String(targetDetails.id), {
    id: targetDetails.id,
    name: targetDetails.name,
    preferred_common_name: targetDetails.preferred_common_name,
    rank: targetDetails.rank,
  });

  const ancestorIds = [];
  rankSteps.forEach((step) => {
    ancestorIds.push(String(step.correctId));
    step.distractorIds.forEach((id) => ancestorIds.push(String(id)));
  });

  speciesCandidates.forEach((candidate) => {
    detailIds.add(String(candidate.id));
  });

  ancestorIds.forEach((id) => {
    detailIds.add(id);
  });

  buildFallbackDetailsForSpecies(speciesCandidates, fallbackDetails);
  rankSteps.forEach((step) => {
    step.distractorSnapshots.forEach((snapshot) => {
      if (snapshot?.id) {
        const key = String(snapshot.id);
        if (!fallbackDetails.has(key)) {
          fallbackDetails.set(key, {
            id: snapshot.id,
            name: snapshot.name,
            preferred_common_name: snapshot.preferred_common_name,
            rank: snapshot.rank,
          });
        }
      }
    });
  });

  const detailList = await getFullTaxaDetails(
    Array.from(detailIds),
    locale,
    { logger, requestId, fallbackDetails },
    taxonDetailsCache
  );

  const detailMap = new Map();
  detailList.forEach((taxon) => {
    if (taxon?.id != null) {
      detailMap.set(String(taxon.id), taxon);
    }
  });

  const steps = [];
  for (const step of rankSteps) {
    const stepDetails = [];
    const correctDetail = detailMap.get(String(step.correctId));
    if (correctDetail) {
      stepDetails.push(correctDetail);
    }
    step.distractorIds.forEach((id) => {
      const detail = detailMap.get(String(id));
      if (detail && !stepDetails.find((d) => String(d.id) === id)) {
        stepDetails.push(detail);
      }
    });

    if (!correctDetail) continue;

    const optionPool = shuffleFisherYates(
      stepDetails.map((detail) => ({
        taxon_id: String(detail.id),
        name: detail.name,
        preferred_common_name: detail.preferred_common_name || detail.common_name || null,
        rank: detail.rank,
      })),
      rng
    );

    const parentDetail =
      step.parentRank && detailMap.has(String(step.parentId))
        ? detailMap.get(String(step.parentId))
        : null;

    steps.push({
      rank: step.rank,
      parent: parentDetail
        ? {
            taxon_id: String(parentDetail.id),
            name: getTaxonName(parentDetail),
            rank: parentDetail.rank,
          }
        : null,
      options: optionPool.slice(0, MAX_OPTIONS_PER_RANK),
      correct_taxon_id: String(correctDetail.id),
    });
  }

  // Species level (override options to use actual species candidates)
  const speciesStep = steps.find((s) => s.rank === 'species');
  if (speciesStep) {
    const speciesOptions = [
      detailMap.get(String(targetDetails.id)),
      ...speciesCandidates.map((candidate) => detailMap.get(String(candidate.id))).filter(Boolean),
    ]
      .filter(Boolean)
      .slice(0, MAX_SPECIES_OPTIONS);

    speciesStep.options = shuffleFisherYates(
      speciesOptions.map((detail) => ({
        taxon_id: String(detail.id),
        name: detail.name,
        preferred_common_name: detail.preferred_common_name || detail.common_name || null,
        rank: detail.rank,
      })),
      rng
    );
    speciesStep.correct_taxon_id = String(targetDetails.id);
  }

  return {
    steps,
    target: targetDetails,
    detailMap,
    meta: {
      maxMistakes: TAXONOMIC_MAX_MISTAKES,
      hintCost: TAXONOMIC_HINT_COST_XP,
      optionsPerStep: MAX_OPTIONS_PER_RANK,
    },
  };
}
