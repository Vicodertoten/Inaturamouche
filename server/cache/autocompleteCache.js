// server/cache/autocompleteCache.js
// Cache pour l'autocomplétion

import { SmartCache } from '../../lib/smart-cache.js';
import { config } from '../config/index.js';

const { maxCacheEntries, autocompleteCacheTtl, autocompleteCacheStaleTtl } = config;

export const autocompleteCache = new SmartCache({
  max: maxCacheEntries,
  ttl: autocompleteCacheTtl,
  staleTtl: autocompleteCacheStaleTtl,
});

export default autocompleteCache;
