// server/routes/metrics.js
// First-party product metrics endpoints (ingestion + dashboard).

import { Router } from 'express';
import { z } from 'zod';
import { config } from '../config/index.js';
import { isAuthorized, isConfiguredToken } from '../utils/auth.js';
import { sendError } from '../utils/http.js';
import { recordClientEvents, getMetricsDashboard } from '../services/metricsStore.js';

const router = Router();

const EVENT_NAMES = ['app_open', 'round_start', 'round_complete', 'report_submit', 'client_error', 'api_error'];

const eventPropertiesSchema = z.record(
  z.union([z.string().max(300), z.number(), z.boolean(), z.null()])
).optional();

const metricEventSchema = z.object({
  name: z.enum(EVENT_NAMES),
  session_id: z.string().trim().min(3).max(120).optional(),
  ts: z.coerce.number().int().positive().optional(),
  properties: eventPropertiesSchema,
});

const metricPayloadSchema = z.union([
  z.object({ events: z.array(metricEventSchema).min(1).max(50) }),
  metricEventSchema,
]);

const metricsDashboardToken = config.metricsDashboardToken;
const requireMetricsDashboardToken = config.metricsDashboardRequireToken || config.nodeEnv === 'production';

router.post('/api/metrics/events', async (req, res) => {
  const parsed = metricPayloadSchema.safeParse(req.body || {});
  if (!parsed.success) {
    return sendError(req, res, {
      status: 400,
      code: 'BAD_REQUEST',
      message: 'Bad request',
      issues: parsed.error.issues,
    });
  }

  try {
    const events = Array.isArray(parsed.data?.events) ? parsed.data.events : [parsed.data];
    const accepted = await recordClientEvents(events);
    return res.status(202).json({
      accepted,
      success: true,
    });
  } catch (err) {
    req.log?.error({ err, requestId: req.id }, 'Metrics ingestion failed');
    return sendError(req, res, {
      status: 500,
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Internal server error',
    });
  }
});

router.get('/api/metrics/dashboard', async (req, res) => {
  try {
    if (requireMetricsDashboardToken) {
      if (!isConfiguredToken(metricsDashboardToken)) {
        return sendError(req, res, {
          status: 503,
          code: 'METRICS_DASHBOARD_DISABLED',
          message: 'Metrics dashboard is not configured.',
        });
      }
      if (!isAuthorized(req, metricsDashboardToken)) {
        return sendError(req, res, {
          status: 401,
          code: 'UNAUTHORIZED',
          message: 'Unauthorized',
        });
      }
    }

    const windowHours = Number.parseInt(String(req.query?.window_hours ?? 24), 10);
    const snapshot = await getMetricsDashboard({ windowHours });
    return res.json(snapshot);
  } catch (err) {
    req.log?.error({ err, requestId: req.id }, 'Metrics dashboard failed');
    return sendError(req, res, {
      status: 500,
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Internal server error',
    });
  }
});

export default router;
