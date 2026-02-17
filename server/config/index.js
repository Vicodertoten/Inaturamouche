// server/config/index.js
// Configuration centralisée de l'application
import dotenv from 'dotenv';

dotenv.config();

const DEFAULT_CORS_ORIGINS = [
  'http://localhost:5173',
  'https://inaturaquizz.com',
  'https://www.inaturaquizz.com',
  'https://inaturamouche.netlify.app',
];

function normalizeOrigin(value) {
  if (typeof value !== 'string') return '';
  return value
    .trim()
    .replace(/^['"]|['"]$/g, '')
    .replace(/\/+$/, '');
}

function parseCsvList(value, fallback = []) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return fallback.map(normalizeOrigin).filter(Boolean);
  }

  const items = value
    .split(',')
    .map((item) => normalizeOrigin(item))
    .filter(Boolean);

  return items.length > 0
    ? Array.from(new Set(items))
    : fallback.map(normalizeOrigin).filter(Boolean);
}

const rawCorsOrigins = process.env.CORS_ORIGINS ?? process.env.CORS_ORIGIN ?? '';

function parseIntWithFallback(value, fallback, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function parseFloatWithFallback(value, fallback, { min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER } = {}) {
  const parsed = Number.parseFloat(String(value ?? ''));
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function parseBoolean(value, fallback = false) {
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}

export const config = {
  // Serveur
  port: process.env.PORT || 3001,
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // Proxy
  trustProxyList: process.env.TRUST_PROXY_LIST || 'loopback,uniquelocal',

  // CORS
  corsOrigins: parseCsvList(rawCorsOrigins, DEFAULT_CORS_ORIGINS),
  
  // Timeouts & Retries
  requestTimeoutMs: parseIntWithFallback(process.env.INAT_REQUEST_TIMEOUT_MS, 8000, { min: 500, max: 30000 }),
  maxRetries: parseIntWithFallback(process.env.INAT_MAX_RETRIES, 2, { min: 0, max: 6 }),
  inatMaxConcurrentRequests: parseIntWithFallback(process.env.INAT_MAX_CONCURRENT_REQUESTS, 14, {
    min: 2,
    max: 200,
  }),
  inatBackoffBaseMs: parseIntWithFallback(process.env.INAT_BACKOFF_BASE_MS, 350, { min: 50, max: 5000 }),
  inatBackoffMaxMs: parseIntWithFallback(process.env.INAT_BACKOFF_MAX_MS, 6000, { min: 300, max: 60000 }),

  // AI Service
  aiApiKey: process.env.AI_API_KEY,
  aiEnabled: parseBoolean(process.env.AI_ENABLED, true),
  explainRateLimitPerMinute: parseIntWithFallback(process.env.EXPLAIN_RATE_LIMIT_PER_MINUTE, 8, { min: 1, max: 200 }),
  explainDailyQuotaPerIp: parseIntWithFallback(process.env.EXPLAIN_DAILY_QUOTA_PER_IP, 60, { min: 1, max: 5000 }),

  // Reports
  reportsRequireWriteToken: parseBoolean(process.env.REPORTS_REQUIRE_WRITE_TOKEN, true),
  reportsRateLimitPerWindow: parseIntWithFallback(process.env.REPORTS_RATE_LIMIT_PER_WINDOW, 8, { min: 1, max: 200 }),
  reportsRateLimitWindowMs: parseIntWithFallback(process.env.REPORTS_RATE_LIMIT_WINDOW_MS, 10 * 60 * 1000, {
    min: 10 * 1000,
    max: 24 * 60 * 60 * 1000,
  }),
  balanceDashboardToken: process.env.BALANCE_DASHBOARD_TOKEN || '',
  balanceDashboardRequireToken: parseBoolean(process.env.BALANCE_DASHBOARD_REQUIRE_TOKEN, true),
  balanceDashboardEventLimit: parseIntWithFallback(process.env.BALANCE_DASHBOARD_EVENT_LIMIT, 2000, {
    min: 100,
    max: 20000,
  }),

  // Adaptive difficulty tuning (last-N validated rounds)
  adaptivePerformanceWindow: parseIntWithFallback(process.env.ADAPTIVE_PERFORMANCE_WINDOW, 10, {
    min: 5,
    max: 30,
  }),
  adaptiveMinSamples: parseIntWithFallback(process.env.ADAPTIVE_MIN_SAMPLES, 5, {
    min: 3,
    max: 20,
  }),
  adaptiveHarderAccuracy: parseFloatWithFallback(process.env.ADAPTIVE_HARDER_ACCURACY, 0.8, {
    min: 0.5,
    max: 0.99,
  }),
  adaptiveEasierAccuracy: parseFloatWithFallback(process.env.ADAPTIVE_EASIER_ACCURACY, 0.45, {
    min: 0.01,
    max: 0.7,
  }),
  adaptiveLureDelta: parseFloatWithFallback(process.env.ADAPTIVE_LURE_DELTA, 0.04, {
    min: 0.01,
    max: 0.2,
  }),
  // Global difficulty boost:
  // 0   => no boost
  // 0.2 => "20% harder" baseline (lures are closer to the target)
  globalDifficultyBoost: parseFloatWithFallback(process.env.GLOBAL_DIFFICULTY_BOOST, 0.2, {
    min: -0.5,
    max: 0.8,
  }),
  iconicRotationWindow: parseIntWithFallback(process.env.ICONIC_ROTATION_WINDOW, 6, {
    min: 3,
    max: 20,
  }),
  iconicRotationDominance: parseFloatWithFallback(process.env.ICONIC_ROTATION_DOMINANCE, 0.66, {
    min: 0.5,
    max: 0.95,
  }),
  
  // Cache TTLs (en millisecondes)
  questionCacheTtl: parseIntWithFallback(process.env.QUESTION_CACHE_TTL_MS, 1000 * 60 * 10, {
    min: 1000 * 30,
    max: 1000 * 60 * 60 * 6,
  }),
  questionCacheStaleTtl: parseIntWithFallback(process.env.QUESTION_CACHE_STALE_TTL_MS, 1000 * 60 * 30, {
    min: 1000 * 30,
    max: 1000 * 60 * 60 * 24,
  }),
  autocompleteCacheTtl: parseIntWithFallback(process.env.AUTOCOMPLETE_CACHE_TTL_MS, 1000 * 60 * 15, {
    min: 1000 * 30,
    max: 1000 * 60 * 60 * 6,
  }),
  autocompleteCacheStaleTtl: parseIntWithFallback(process.env.AUTOCOMPLETE_CACHE_STALE_TTL_MS, 1000 * 60 * 60, {
    min: 1000 * 30,
    max: 1000 * 60 * 60 * 24,
  }),
  taxonDetailsCacheTtl: parseIntWithFallback(process.env.TAXON_DETAILS_CACHE_TTL_MS, 1000 * 60 * 60 * 24, {
    min: 1000 * 60,
    max: 1000 * 60 * 60 * 24 * 14,
  }),
  taxonDetailsCacheStaleTtl: parseIntWithFallback(
    process.env.TAXON_DETAILS_CACHE_STALE_TTL_MS,
    1000 * 60 * 60 * 24 * 7,
    { min: 1000 * 60, max: 1000 * 60 * 60 * 24 * 60 }
  ),
  similarSpeciesCacheTtl: parseIntWithFallback(process.env.SIMILAR_SPECIES_CACHE_TTL_MS, 1000 * 60 * 60 * 24 * 7, {
    min: 1000 * 60,
    max: 1000 * 60 * 60 * 24 * 30,
  }),
  similarSpeciesCacheStaleTtl: parseIntWithFallback(
    process.env.SIMILAR_SPECIES_CACHE_STALE_TTL_MS,
    1000 * 60 * 60 * 24 * 30,
    { min: 1000 * 60, max: 1000 * 60 * 60 * 24 * 90 }
  ),
  selectionStateTtl: parseIntWithFallback(process.env.SELECTION_STATE_TTL_MS, 1000 * 60 * 20, {
    min: 1000 * 30,
    max: 1000 * 60 * 60 * 4,
  }),
  
  // Cache limits
  maxCacheEntries: parseIntWithFallback(process.env.MAX_QUESTION_CACHE_ENTRIES, 500, { min: 50, max: 20000 }),
  maxTaxonDetailsCache: parseIntWithFallback(process.env.MAX_TAXON_DETAILS_CACHE_ENTRIES, 12000, {
    min: 1000,
    max: 200000,
  }),
  maxSelectionStates: parseIntWithFallback(process.env.MAX_SELECTION_STATES, 1200, { min: 100, max: 20000 }),
  maxSimilarSpeciesCache: parseIntWithFallback(process.env.MAX_SIMILAR_SPECIES_CACHE_ENTRIES, 5000, {
    min: 200,
    max: 100000,
  }),
  
  // Quiz settings
  quizChoices: 4,
  lureCount: 3, // QUIZ_CHOICES - 1
  questionQueueSize: 3,
  obsHistoryLimit: 50,

  // Round validation security
  roundStateTtl: parseIntWithFallback(process.env.ROUND_STATE_TTL_MS, 1000 * 60 * 15, {
    min: 1000 * 30,
    max: 1000 * 60 * 60,
  }),
  roundHmacSecret: process.env.ROUND_HMAC_SECRET || '',
  
  // Cooldown
  cooldownTargetN: 60,
  cooldownTargetMs: null, // null = désactivé
  cooldownLureN: parseIntWithFallback(process.env.COOLDOWN_LURE_N, 6, { min: 0, max: 60 }),
  
  // Pool extension
  maxObsPages: parseIntWithFallback(process.env.OBS_POOL_MAX_PAGES, 3, { min: 1, max: 12 }),
  distinctTaxaTarget: parseIntWithFallback(process.env.OBS_POOL_DISTINCT_TAXA_TARGET, 30, { min: 4, max: 500 }),
  degradePoolMaxTaxa: parseIntWithFallback(process.env.DEGRADE_POOL_MAX_TAXA, 24, { min: 4, max: 200 }),
  degradePoolMaxObsPerTaxon: parseIntWithFallback(process.env.DEGRADE_POOL_MAX_OBS_PER_TAXON, 2, { min: 1, max: 6 }),
  
  // Lure thresholds (profondeur LCA normalisée)
  lureNearThreshold: 0.9,
  lureMidThreshold: 0.75,
  easyLureMinCloseness: 0.82,
  hardLureMinCloseness: 0.74,
  riddleLureMinCloseness: 0.76,
  
  // Circuit breaker
  inatCircuitFailureThreshold: 3,
  inatCircuitCooldownMs: 15000,
  inatCircuitHalfOpenMax: 1,
};

export default config;
