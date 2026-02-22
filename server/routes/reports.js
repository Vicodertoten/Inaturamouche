// server/routes/reports.js
// Route pour recevoir les rapports de bugs

import { Router } from 'express';
import { config } from '../config/index.js';
import { reportsLimiter } from '../middleware/rateLimiter.js';
import { getClientIp } from '../utils/helpers.js';
import { validate, reportSchema } from '../utils/validation.js';
import { isAuthorized, isConfiguredToken } from '../utils/auth.js';
import { sendError } from '../utils/http.js';
import { addReport, listReports, getReportsCount } from '../services/reportsStore.js';
import { recordClientEvent } from '../services/metricsStore.js';

const router = Router();

const REPORTS_WRITE_TOKEN = process.env.REPORTS_WRITE_TOKEN;
const REPORTS_READ_TOKEN = process.env.REPORTS_READ_TOKEN;
const { reportsRequireWriteToken } = config;
const requireWriteToken = reportsRequireWriteToken;

function getReportSessionId(req) {
  return req.headers['x-client-session-id']
    ? String(req.headers['x-client-session-id']).slice(0, 120)
    : null;
}

function trackReportSubmit(req, properties = {}) {
  void recordClientEvent({
    name: 'report_submit',
    session_id: getReportSessionId(req),
    properties,
  }).catch(() => {});
}

function sanitizeReportUrl(rawUrl) {
  const input = String(rawUrl || '').trim();
  if (!input) return '';
  try {
    const parsed = new URL(input);
    return `${parsed.origin}${parsed.pathname}`.slice(0, 500);
  } catch {
    return input.slice(0, 500);
  }
}

// Endpoint pour recevoir un rapport
router.post('/api/reports', reportsLimiter, validate(reportSchema), async (req, res) => {
  try {
    if (requireWriteToken) {
      if (!isConfiguredToken(REPORTS_WRITE_TOKEN)) {
        req.log?.error({ route: '/api/reports' }, 'REPORTS_WRITE_TOKEN is required but not configured');
        trackReportSubmit(req, {
          success: false,
          http_status: 503,
          reason: 'write_token_not_configured',
        });
        return sendError(req, res, {
          status: 503,
          code: 'REPORTS_DISABLED',
          message: 'Reports endpoint is not configured.',
        });
      }
      if (!isAuthorized(req, REPORTS_WRITE_TOKEN)) {
        trackReportSubmit(req, {
          success: false,
          http_status: 401,
          reason: 'unauthorized',
        });
        return sendError(req, res, {
          status: 401,
          code: 'UNAUTHORIZED',
          message: 'Unauthorized',
        });
      }
    }

    const { description, url, userAgent, website } = req.valid;
    const sourceIp = getClientIp(req) || null;
    const locale = req.headers['accept-language'] ? String(req.headers['accept-language']).slice(0, 24) : null;
    const mode = req.headers['x-game-mode'] ? String(req.headers['x-game-mode']).slice(0, 32) : null;
    const route = req.headers['x-current-route'] ? String(req.headers['x-current-route']).slice(0, 120) : null;
    const safeUrl = sanitizeReportUrl(url);

    // Honeypot: si rempli, on simule un succès sans stocker.
    if (website) {
      req.log?.warn({ requestId: req.id }, 'Report honeypot triggered');
      trackReportSubmit(req, {
        success: true,
        honeypot: true,
        http_status: 202,
      });
      return res.status(202).json({
        success: true,
        accepted: true,
      });
    }

    const report = await addReport({
      description,
      url: safeUrl,
      userAgent: String(userAgent || ''),
      sourceIp,
      locale,
      mode,
      route,
      requestId: req.id,
    });

    req.log?.info({
      id: report.id,
      descriptionPreview: report.description.substring(0, 100),
      timestamp: report.timestamp
    }, 'Bug report stored');

    trackReportSubmit(req, {
      success: true,
      http_status: 200,
    });

    res.json({
      success: true,
      message: 'Report received successfully.',
      reportId: report.id
    });

  } catch (error) {
    req.log?.error({ err: error }, 'Failed to process report');
    trackReportSubmit(req, {
      success: false,
      http_status: 500,
      reason: 'server_error',
    });
    return sendError(req, res, {
      status: 500,
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Internal server error',
    });
  }
});

// Endpoint pour récupérer tous les rapports (pour consultation)
router.get('/api/reports', async (req, res) => {
  try {
    if (!isConfiguredToken(REPORTS_READ_TOKEN)) {
      req.log?.error({ route: '/api/reports' }, 'REPORTS_READ_TOKEN is not configured');
      return sendError(req, res, {
        status: 503,
        code: 'REPORTS_DISABLED',
        message: 'Reports endpoint is not configured.',
      });
    }

    if (!isAuthorized(req, REPORTS_READ_TOKEN)) {
      return sendError(req, res, {
        status: 401,
        code: 'UNAUTHORIZED',
        message: 'Unauthorized',
      });
    }
    const reports = await listReports();
    const total = await getReportsCount();
    res.json({
      reports,
      total,
    });
  } catch (error) {
    req.log?.error({ err: error }, 'Failed to read reports');
    return sendError(req, res, {
      status: 500,
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Internal server error',
    });
  }
});

export default router;
