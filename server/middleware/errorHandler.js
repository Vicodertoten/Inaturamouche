// server/middleware/errorHandler.js
// Gestion globale des erreurs

/**
 * Middleware de gestion des erreurs 404
 */
export function notFoundHandler(_, res) {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Not Found' } });
}

/**
 * Middleware de gestion des erreurs générales (optionnel, non utilisé actuellement)
 */
export function errorHandler(err, req, res, next) {
  req.log?.error({ err, requestId: req.id }, 'Unhandled error');
  
  const status = err.status || err.statusCode || 500;
  const code = err.code || 'INTERNAL_SERVER_ERROR';
  const message = err.message || 'Internal server error';
  
  res.status(status).json({
    error: {
      code,
      message,
    },
  });
}
