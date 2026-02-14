// server/middleware/errorHandler.js
// Gestion globale des erreurs

import { sendError } from '../utils/http.js';

/**
 * Middleware de gestion des erreurs 404
 */
export function notFoundHandler(req, res) {
  return sendError(req, res, {
    status: 404,
    code: 'NOT_FOUND',
    message: 'Not Found',
  });
}

/**
 * Middleware de gestion des erreurs générales
 */
export function errorHandler(err, req, res, _next) {
  req.log?.error({ err, requestId: req.id }, 'Unhandled error');

  const status = Number.parseInt(String(err?.status ?? err?.statusCode ?? 500), 10) || 500;
  const code = typeof err?.code === 'string' ? err.code : status === 404 ? 'NOT_FOUND' : 'INTERNAL_SERVER_ERROR';
  const message = status >= 500 ? 'Internal server error' : err?.message || 'Error';

  return sendError(req, res, {
    status,
    code,
    message,
  });
}
