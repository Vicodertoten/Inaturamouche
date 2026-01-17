// server/cache/taxonDetailsCache.js
// Cache pour les détails des taxons

import { SmartCache } from '../../lib/smart-cache.js';
import { config } from '../config/index.js';

const { maxTaxonDetailsCache, taxonDetailsCacheTtl, taxonDetailsCacheStaleTtl } = config;

export const taxonDetailsCache = new SmartCache({
  max: maxTaxonDetailsCache,
  ttl: taxonDetailsCacheTtl,
  staleTtl: taxonDetailsCacheStaleTtl,
});

export default taxonDetailsCache;
