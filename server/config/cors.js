// server/config/cors.js
// Configuration CORS

import { config } from './index.js';

export const allowedOrigins = config.corsOrigins;
const DEV_LOCAL_ORIGIN_RE = /^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d{1,5})?$/i;

function normalizeOrigin(value) {
  if (typeof value !== 'string') return '';
  return value.trim().replace(/\/+$/, '');
}

export const corsOptions = {
  origin(origin, cb) {
    const normalizedOrigin = normalizeOrigin(origin);
    const isDevLocalOrigin =
      config.nodeEnv !== 'production' && DEV_LOCAL_ORIGIN_RE.test(normalizedOrigin);

    if (!normalizedOrigin || allowedOrigins.includes(normalizedOrigin) || isDevLocalOrigin) {
      return cb(null, true);
    }
    const err = new Error('Origin not allowed by CORS');
    err.status = 403;
    return cb(err);
  },
  credentials: false,
  methods: ['GET', 'POST', 'PUT', 'OPTIONS'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
  ],
  exposedHeaders: [
    'Content-Length',
    'Content-Type',
    'X-Cache-Key',
    'X-Lures-Relaxed',
    'X-Lure-Buckets',
    'X-Pool-Pages',
    'X-Pool-Obs',
    'X-Pool-Taxa',
    'Server-Timing',
    'X-Timing',
  ],
};

export default corsOptions;
