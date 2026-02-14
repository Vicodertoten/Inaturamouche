// server/middleware/logging.js
// Configuration Pino pour les logs HTTP structurés

import { randomUUID } from 'node:crypto';
import pinoHttp from 'pino-http';

export const httpLogger = pinoHttp({
  redact: ['req.headers.authorization', 'req.headers.cookie'],
  autoLogging: true,
  genReqId(req, res) {
    const incoming = req.headers['x-request-id'];
    const requestId =
      typeof incoming === 'string' && incoming.trim().length > 0 ? incoming.trim() : randomUUID();
    res.setHeader('X-Request-Id', requestId);
    return requestId;
  },
});
