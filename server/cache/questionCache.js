// server/cache/questionCache.js
// Cache pour les pools de questions

import { SmartCache } from '../../lib/smart-cache.js';
import { config } from '../config/index.js';

const { maxCacheEntries, questionCacheTtl, questionCacheStaleTtl } = config;

export const questionCache = new SmartCache({
  max: maxCacheEntries,
  ttl: questionCacheTtl,
  staleTtl: questionCacheStaleTtl,
});

export default questionCache;
