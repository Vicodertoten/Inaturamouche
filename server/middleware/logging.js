// server/middleware/logging.js
// Configuration Pino pour les logs HTTP structurés

import pinoHttp from 'pino-http';

export const httpLogger = pinoHttp({
  redact: ['req.headers.authorization', 'req.headers.cookie'],
  autoLogging: true,
});
