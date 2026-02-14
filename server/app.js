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
  app.set('etag', false);

  app.use(compression());
  app.use(express.json({ limit: '1mb' }));

  // HTTP logging (Pino)
  app.use(httpLogger);

  // Rate limiting
  app.use('/api', apiLimiter);

  // Cache policy
  app.use((req, res, next) => {
    if (req.path.startsWith('/api/')) {
      res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');
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
