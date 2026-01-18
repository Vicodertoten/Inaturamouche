// server/config/index.js
// Configuration centralisée de l'application
import dotenv from 'dotenv';

dotenv.config();

export const config = {
  // Serveur
  port: process.env.PORT || 3001,
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // Proxy
  trustProxyList: process.env.TRUST_PROXY_LIST || 'loopback,uniquelocal',
  
  // Timeouts & Retries
  requestTimeoutMs: 8000,
  maxRetries: 2,

  // AI Service
  aiApiKey: process.env.AI_API_KEY,
  
  // Cache TTLs (en millisecondes)
  questionCacheTtl: 1000 * 60 * 5,        // 5 min
  questionCacheStaleTtl: 1000 * 60 * 15,  // 15 min
  autocompleteCacheTtl: 1000 * 60 * 10,   // 10 min
  autocompleteCacheStaleTtl: 1000 * 60 * 60, // 1h
  taxonDetailsCacheTtl: 1000 * 60 * 60 * 24,  // 24h
  taxonDetailsCacheStaleTtl: 1000 * 60 * 60 * 24 * 7, // 7d
  similarSpeciesCacheTtl: 1000 * 60 * 60 * 24 * 7,    // 7 jours
  similarSpeciesCacheStaleTtl: 1000 * 60 * 60 * 24 * 30, // 30 jours
  selectionStateTtl: 1000 * 60 * 10,      // 10 min
  
  // Cache limits
  maxCacheEntries: 50,
  maxTaxonDetailsCache: 2000,
  maxSelectionStates: 200,
  maxSimilarSpeciesCache: 1000,
  
  // Quiz settings
  quizChoices: 4,
  lureCount: 3, // QUIZ_CHOICES - 1
  questionQueueSize: 3,
  obsHistoryLimit: 50,
  
  // Cooldown
  cooldownTargetN: 60,
  cooldownTargetMs: null, // null = désactivé
  
  // Pool extension
  maxObsPages: 1,
  distinctTaxaTarget: 30,
  
  // Lure thresholds (profondeur LCA normalisée)
  lureNearThreshold: 0.85,
  lureMidThreshold: 0.65,
  
  // Circuit breaker
  inatCircuitFailureThreshold: 3,
  inatCircuitCooldownMs: 15000,
  inatCircuitHalfOpenMax: 1,
};

export default config;
