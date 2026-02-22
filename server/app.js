// server/app.js
// Configuration et assemblage de l'application Express

import express from 'express';
import cors from 'cors';
import compression from 'compression';
import helmet from 'helmet';
import { config } from './config/index.js';
import corsOptions from './config/cors.js';
import { httpLogger } from './middleware/logging.js';
import { apiLimiter } from './middleware/rateLimiter.js';
import { notFoundHandler, errorHandler } from './middleware/errorHandler.js';
import routes from './routes/index.js';
import { recordApiMetric } from './services/metricsStore.js';

/**
 * Create and configure Express application
 * @returns {{ app: express.Application, logger: any }}
 */
export function createApp() {
  const app = express();

  // Trust proxy configuration
  const trustedProxyEntries = config.trustProxyList
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

  if (trustedProxyEntries.length > 0) {
    app.set('trust proxy', trustedProxyEntries);
  }

  // CORS
  app.use(cors(corsOptions));
  app.use((_, res, next) => {
    res.header('Vary', 'Origin');
    next();
  });

  // Security & Performance
  app.use(
    helmet({
      crossOriginResourcePolicy: false,
      crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          'default-src': ["'self'"],
          'connect-src': ["'self'", 'https://api.inaturalist.org', 'https://*.wikipedia.org', 'https://generativelanguage.googleapis.com'],
          'img-src': [
            "'self'",
            'data:',
            'https:',
            'https://static.inaturalist.org',
            'https://inaturalist-open-data.s3.amazonaws.com',
          ],
          'media-src': [
            "'self'",
            'https://static.inaturalist.org',
            'https://inaturalist-open-data.s3.amazonaws.com',
          ],
          'style-src': ["'self'", "'unsafe-inline'"],
          'font-src': ["'self'", 'https:', 'data:'],
          'script-src': ["'self'"],
        },
      },
    })
  );
  app.disable('x-powered-by');
  app.set('etag', 'weak');

  app.use(compression());
  app.use(express.json({ limit: '1mb' }));

  // HTTP logging (Pino)
  app.use(httpLogger);

  // First-party API metrics (latency + status by endpoint)
  app.use((req, res, next) => {
    if (!req.path.startsWith('/api/')) {
      next();
      return;
    }
    const skipPath = req.path === '/api/metrics/events';
    if (skipPath) {
      next();
      return;
    }
    const startedAt = process.hrtime.bigint();
    res.on('finish', () => {
      const finishedAt = process.hrtime.bigint();
      const durationMs = Number(finishedAt - startedAt) / 1_000_000;
      const tags = {};
      if (req.path === '/api/quiz-question') {
        if (req.query?.pack_id) tags.pack_id = req.query.pack_id;
        if (req.query?.game_mode) tags.game_mode = req.query.game_mode;
        if (req.query?.media_type) tags.media_type = req.query.media_type;
        if (req.query?.locale) tags.locale = req.query.locale;
      } else if (req.path === '/api/quiz/submit' && req.body?.round_action) {
        tags.round_action = req.body.round_action;
      }
      void recordApiMetric({
        method: req.method,
        path: req.path,
        status: res.statusCode,
        duration_ms: durationMs,
        tags,
      }).catch((err) => {
        req.log?.debug?.({ err, requestId: req.id }, 'metrics record failed');
      });
    });
    next();
  });

  // Rate limiting
  app.use('/api', apiLimiter);

  // Cache policy
  app.use((req, res, next) => {
    if (req.path.startsWith('/api/')) {
      const isPackPreview = /^\/api\/packs\/[^/]+\/preview$/.test(req.path);
      const isPackCatalog = req.path === '/api/packs' || req.path === '/api/packs/home';
      const isAutocompleteEndpoint =
        req.path === '/api/taxa/autocomplete' || req.path === '/api/places';
      const isLookupEndpoint =
        req.path === '/api/places/by-id' ||
        req.path === '/api/taxa' ||
        /^\/api\/taxon\/[^/]+$/.test(req.path) ||
        req.path === '/api/observations/species_counts';

      // Cache only stable/read-only endpoints. Quiz/session endpoints remain strictly no-store.
      if (isPackPreview) {
        res.set('Cache-Control', 'public, max-age=3600, stale-while-revalidate=7200');
      } else if (isPackCatalog) {
        res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=3600');
      } else if (isAutocompleteEndpoint) {
        res.set('Cache-Control', 'public, max-age=120, stale-while-revalidate=600');
      } else if (isLookupEndpoint) {
        res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
      } else {
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.set('Pragma', 'no-cache');
        res.set('Expires', '0');
      }
      res.set('Vary', 'Origin, Accept-Language');
    } else {
      res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=3600');
    }
    next();
  });

  // Routes
  app.use(routes);

  // 404 handler
  app.use(notFoundHandler);
  app.use(errorHandler);

  return { app, logger: httpLogger.logger };
}

export default createApp;
