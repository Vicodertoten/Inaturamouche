// server/services/lures-v2/Selector.js
// Sélection des lures avec composition par bucket et ladder de relaxation

const RELAX_STEPS = [
  { minDrop: 0.0, thresholdDrop: 0.0, allowCrossIconic: false },
  { minDrop: 0.05, thresholdDrop: 0.03, allowCrossIconic: false },
  { minDrop: 0.1, thresholdDrop: 0.06, allowCrossIconic: true },
  { minDrop: 0.14, thresholdDrop: 0.1, allowCrossIconic: true },
];

function isCrossIconic(candidate) {
  const src = String(candidate?.source || '');
  return src.includes('cross-iconic');
}

function weightedPick(candidates, rng, lureUsageCount) {
  if (!Array.isArray(candidates) || candidates.length === 0) return null;
  const random = typeof rng === 'function' ? rng : Math.random;

  const weighted = candidates.map((candidate) => {
    const usage = lureUsageCount?.get?.(String(candidate.tid)) || 0;
    const base = Math.max(0.001, Number(candidate.score) || 0.001);
    const weight = base / (usage + 1);
    return { candidate, weight };
  });

  const total = weighted.reduce((sum, item) => sum + item.weight, 0);
  if (total <= 0) {
    return weighted[Math.floor(random() * weighted.length)]?.candidate || null;
  }

  let cursor = random() * total;
  for (const item of weighted) {
    cursor -= item.weight;
    if (cursor <= 0) return item.candidate;
  }
  return weighted[weighted.length - 1]?.candidate || null;
}

function pickFromPool(pool, count, picked, rng, lureUsageCount) {
  const out = [];
  while (out.length < count) {
    const available = pool.filter((candidate) => !picked.has(String(candidate.tid)));
    if (available.length === 0) break;
    const chosen = weightedPick(available, rng, lureUsageCount);
    if (!chosen) break;
    picked.add(String(chosen.tid));
    out.push(chosen);
  }
  return out;
}

function classifyCandidate(candidate, thresholds) {
  if (candidate.closeness >= thresholds.closeThreshold) return 'close';
  if (candidate.closeness >= thresholds.midThreshold) return 'mid';
  return 'far';
}

function splitByBuckets(candidates, thresholds) {
  const buckets = {
    close: [],
    mid: [],
    far: [],
  };
  for (const candidate of candidates) {
    const bucket = classifyCandidate(candidate, thresholds);
    buckets[bucket].push(candidate);
  }
  return buckets;
}

export function selectLureCandidates({
  candidates,
  lureCount,
  policy,
  excludeTaxonIds,
  lureUsageCount,
  rng,
  strictMinCloseness = false,
}) {
  const random = typeof rng === 'function' ? rng : Math.random;
  const steps = strictMinCloseness ? [RELAX_STEPS[0]] : RELAX_STEPS;

  for (let level = 0; level < steps.length; level += 1) {
    const relax = steps[level];
    const minCloseness = Math.max(0, policy.minCloseness - relax.minDrop);
    const closeThreshold = Math.max(0, policy.closeThreshold - relax.thresholdDrop);
    const midThreshold = Math.max(0, Math.min(closeThreshold - 0.01, policy.midThreshold - relax.thresholdDrop));

    const eligible = (candidates || []).filter((candidate) => {
      const tid = String(candidate.tid);
      if (!tid || excludeTaxonIds?.has?.(tid)) return false;
      if ((Number(candidate.closeness) || 0) < minCloseness) return false;
      if (!relax.allowCrossIconic && isCrossIconic(candidate)) return false;
      return true;
    });

    if (eligible.length === 0) continue;

    const buckets = splitByBuckets(eligible, { closeThreshold, midThreshold });
    const picked = new Set();
    const selected = [];

    for (const rule of policy.composition || []) {
      const required = Math.max(0, Number(rule.count) || 0);
      if (required === 0) continue;

      let source = [];
      if (rule.bucket === 'close') {
        source = [...buckets.close, ...buckets.mid, ...buckets.far];
      } else if (rule.bucket === 'mid') {
        source = [...buckets.mid, ...buckets.close, ...buckets.far];
      } else {
        source = [...buckets.far, ...buckets.mid, ...buckets.close];
      }

      const picks = pickFromPool(source, required, picked, random, lureUsageCount);
      selected.push(...picks);
    }

    if (selected.length < lureCount) {
      const topUp = pickFromPool(eligible, lureCount - selected.length, picked, random, lureUsageCount);
      selected.push(...topUp);
    }

    if (selected.length >= lureCount) {
      return {
        selected: selected.slice(0, lureCount),
        relaxLevel: level,
      };
    }
  }

  const fallback = (candidates || [])
    .filter((candidate) => {
      const tid = String(candidate.tid);
      if (excludeTaxonIds?.has?.(tid)) return false;
      if (strictMinCloseness && (Number(candidate.closeness) || 0) < policy.minCloseness) return false;
      return true;
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, lureCount);

  return {
    selected: fallback,
    relaxLevel: steps.length,
  };
}

export default selectLureCandidates;
