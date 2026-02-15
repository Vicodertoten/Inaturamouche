// server/routes/reports.js
// Route pour recevoir les rapports de bugs

import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { config } from '../config/index.js';
import { reportsLimiter } from '../middleware/rateLimiter.js';
import { getClientIp } from '../utils/helpers.js';
import { validate, reportSchema } from '../utils/validation.js';
import { isAuthorized, isConfiguredToken } from '../utils/auth.js';
import { sendError } from '../utils/http.js';

const router = Router();

// Stockage temporaire en mémoire (pour les tests)
let reports = [];
const MAX_REPORTS = 200;
const REPORTS_WRITE_TOKEN = process.env.REPORTS_WRITE_TOKEN;
const REPORTS_READ_TOKEN = process.env.REPORTS_READ_TOKEN;
const { reportsRequireWriteToken } = config;

// Endpoint pour recevoir un rapport
router.post('/api/reports', reportsLimiter, validate(reportSchema), (req, res) => {
  try {
    if (reportsRequireWriteToken) {
      if (!isConfiguredToken(REPORTS_WRITE_TOKEN)) {
        req.log?.error({ route: '/api/reports' }, 'REPORTS_WRITE_TOKEN is required but not configured');
        return sendError(req, res, {
          status: 503,
          code: 'REPORTS_DISABLED',
          message: 'Reports endpoint is not configured.',
        });
      }
      if (!isAuthorized(req, REPORTS_WRITE_TOKEN)) {
        return sendError(req, res, {
          status: 401,
          code: 'UNAUTHORIZED',
          message: 'Unauthorized',
        });
      }
    }

    const { description, url, userAgent, website } = req.valid;

    // Honeypot: si rempli, on simule un succès sans stocker.
    if (website) {
      req.log?.warn({ requestId: req.id }, 'Report honeypot triggered');
      return res.status(202).json({
        success: true,
        accepted: true,
      });
    }

    const report = {
      id: randomUUID(),
      description,
      url: String(url || 'Non spécifié').slice(0, 500),
      userAgent: String(userAgent || 'Non spécifié').slice(0, 500),
      sourceIp: getClientIp(req) || null,
      timestamp: new Date().toISOString(),
    };

    // Ajouter le nouveau rapport
    reports.unshift(report);
    if (reports.length > MAX_REPORTS) {
      reports = reports.slice(0, MAX_REPORTS);
    }

    req.log?.info({
      id: report.id,
      descriptionPreview: report.description.substring(0, 100),
      timestamp: report.timestamp
    }, 'Bug report stored');

    res.json({
      success: true,
      message: 'Report received successfully.',
      reportId: report.id
    });

  } catch (error) {
    req.log?.error({ err: error }, 'Failed to process report');
    return sendError(req, res, {
      status: 500,
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Internal server error',
    });
  }
});

// Endpoint pour récupérer tous les rapports (pour consultation)
router.get('/api/reports', (req, res) => {
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
    res.json({
      reports: reports,
      total: reports.length
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
