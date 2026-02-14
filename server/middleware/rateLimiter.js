// server/middleware/rateLimiter.js
// Configuration du rate limiting

import rateLimit from 'express-rate-limit';
import { getClientIp } from '../utils/helpers.js';
import { config } from '../config/index.js';
import { sendError } from '../utils/http.js';

function buildLimiter({ windowMs, limit, code, message }) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator: getClientIp,
    handler: (req, res) =>
      sendError(req, res, {
        status: 429,
        code,
        message,
      }),
  });
}

// Rate limit global pour /api
export const apiLimiter = buildLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 300,
  code: 'RATE_LIMIT_EXCEEDED',
  message: 'Too many requests. Please try again later.',
});

// Rate limit spécifique pour les endpoints de quiz
export const quizLimiter = buildLimiter({
  windowMs: 60 * 1000, // 1 minute
  limit: 60,
  code: 'QUIZ_RATE_LIMIT_EXCEEDED',
  message: 'Too many quiz requests. Please slow down.',
});

// Rate limit pour les endpoints proxy (autocomplete, taxa, places)
export const proxyLimiter = buildLimiter({
  windowMs: 60 * 1000, // 1 minute
  limit: 120,
  code: 'PROXY_RATE_LIMIT_EXCEEDED',
  message: 'Too many lookup requests. Please slow down.',
});

// Rate limit strict pour les explications IA (coût externe)
export const explainLimiter = buildLimiter({
  windowMs: 60 * 1000,
  limit: config.explainRateLimitPerMinute,
  code: 'EXPLAIN_RATE_LIMIT_EXCEEDED',
  message: 'Too many explanation requests. Please wait before trying again.',
});

// Quota journalier IA par IP
export const explainDailyLimiter = buildLimiter({
  windowMs: 24 * 60 * 60 * 1000,
  limit: config.explainDailyQuotaPerIp,
  code: 'EXPLAIN_DAILY_QUOTA_EXCEEDED',
  message: 'Daily explanation quota reached for this IP.',
});

// Limiter anti-spam pour les signalements
export const reportsLimiter = buildLimiter({
  windowMs: config.reportsRateLimitWindowMs,
  limit: config.reportsRateLimitPerWindow,
  code: 'REPORT_RATE_LIMIT_EXCEEDED',
  message: 'Too many reports submitted. Please try again later.',
});
