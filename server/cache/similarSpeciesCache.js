// server/cache/similarSpeciesCache.js
// Cache agressif pour similar_species (7j fresh, 30j stale) - les ressemblances ne changent pas

import { SmartCache } from '../../lib/smart-cache.js';
import { config } from '../config/index.js';

const { maxSimilarSpeciesCache, similarSpeciesCacheTtl, similarSpeciesCacheStaleTtl } = config;

export const similarSpeciesCache = new SmartCache({
  max: maxSimilarSpeciesCache,
  ttl: similarSpeciesCacheTtl,
  staleTtl: similarSpeciesCacheStaleTtl,
});

export default similarSpeciesCache;
