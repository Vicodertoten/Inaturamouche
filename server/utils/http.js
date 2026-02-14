// server/utils/http.js
// Helpers HTTP partagés pour uniformiser les réponses API.

import { config } from '../config/index.js';

function sanitizeStatus(status) {
  const normalized = Number.parseInt(String(status ?? ''), 10);
  if (!Number.isFinite(normalized) || normalized < 100 || normalized > 599) {
    return 500;
  }
  return normalized;
}

export function getRequestId(req) {
  return req?.id ? String(req.id) : null;
}

export function sendError(
  req,
  res,
  {
    status = 500,
    code = 'INTERNAL_SERVER_ERROR',
    message = 'Internal server error',
    issues,
    details,
  } = {}
) {
  const safeStatus = sanitizeStatus(status);
  const payload = {
    error: {
      code: String(code || 'INTERNAL_SERVER_ERROR'),
      message: String(message || 'Internal server error'),
      requestId: getRequestId(req),
    },
  };

  if (Array.isArray(issues) && issues.length > 0) {
    payload.error.issues = issues;
  }

  if (details && config.nodeEnv !== 'production') {
    payload.error.details = details;
  }

  return res.status(safeStatus).json(payload);
}

export function sendInternalError(req, res, err, { code = 'INTERNAL_SERVER_ERROR', message } = {}) {
  req.log?.error({ err, requestId: getRequestId(req) }, 'Unhandled API error');
  return sendError(req, res, {
    status: 500,
    code,
    message: message || 'Internal server error',
  });
}
