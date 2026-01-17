// server/middleware/rateLimiter.js
// Configuration du rate limiting

import rateLimit from 'express-rate-limit';
import { getClientIp } from '../utils/helpers.js';

// Rate limit global pour /api
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 300,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: getClientIp,
});

// Rate limit spécifique pour les endpoints de quiz
export const quizLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  limit: 60,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: getClientIp,
});

// Rate limit pour les endpoints proxy (autocomplete, taxa, places)
export const proxyLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  limit: 120,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: getClientIp,
});
