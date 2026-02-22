// server/services/metricsStore.js
// First-party metrics aggregation (API + client events) with disk persistence.

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../config/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..', '..');

function resolveStorePath(target) {
  if (path.isAbsolute(target)) return target;
  return path.resolve(projectRoot, target);
}

const storeFile = resolveStorePath(config.metricsStoreFile);
const retentionMs = Math.max(24 * 60 * 60 * 1000, Number(config.metricsRetentionHours) * 60 * 60 * 1000);
const maxApiEvents = Math.max(1000, Number(config.metricsMaxApiEvents) || 200000);
const maxClientEvents = Math.max(1000, Number(config.metricsMaxClientEvents) || 100000);

const state = {
  loaded: false,
  apiEvents: [],
  clientEvents: [],
};

let lock = Promise.resolve();
let flushTimer = null;

function runExclusive(task) {
  const next = lock.then(task, task);
  lock = next.catch(() => {});
  return next;
}

function safeJsonParse(raw, fallback) {
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function normalizeApiPath(rawPath) {
  const pathOnly = String(rawPath || '/')
    .split('?')[0]
    .replace(/\/+/g, '/');
  return pathOnly
    .split('/')
    .map((segment, index) => {
      if (index === 0 || segment.length === 0) return segment;
      if (/^\d+$/.test(segment)) return ':id';
      if (/^[0-9a-f]{8,}$/i.test(segment)) return ':id';
      return segment;
    })
    .join('/');
}

function sanitizeApiEvent(event) {
  const ts = Number(event?.ts) || Date.now();
  return {
    ts,
    method: String(event?.method || 'GET').slice(0, 12).toUpperCase(),
    path: normalizeApiPath(event?.path),
    status: Number.parseInt(String(event?.status ?? 0), 10) || 0,
    duration_ms: Math.max(0, Number(event?.duration_ms) || 0),
  };
}

function sanitizeClientEvent(event) {
  const ts = Number(event?.ts) || Date.now();
  const properties = event?.properties && typeof event.properties === 'object' ? event.properties : {};
  return {
    ts,
    name: String(event?.name || '').slice(0, 64),
    session_id: event?.session_id ? String(event.session_id).slice(0, 120) : null,
    properties,
  };
}

function pruneLocked(now = Date.now()) {
  const cutoff = now - retentionMs;
  state.apiEvents = state.apiEvents.filter((event) => Number(event.ts) >= cutoff);
  state.clientEvents = state.clientEvents.filter((event) => Number(event.ts) >= cutoff);
  if (state.apiEvents.length > maxApiEvents) {
    state.apiEvents = state.apiEvents.slice(-maxApiEvents);
  }
  if (state.clientEvents.length > maxClientEvents) {
    state.clientEvents = state.clientEvents.slice(-maxClientEvents);
  }
}

async function ensureLoadedLocked() {
  if (state.loaded) return;
  try {
    const raw = await fs.readFile(storeFile, 'utf8');
    const parsed = safeJsonParse(raw, {});
    state.apiEvents = Array.isArray(parsed?.apiEvents) ? parsed.apiEvents.map(sanitizeApiEvent) : [];
    state.clientEvents = Array.isArray(parsed?.clientEvents)
      ? parsed.clientEvents.map(sanitizeClientEvent).filter((event) => event.name)
      : [];
  } catch (err) {
    if (err?.code !== 'ENOENT') throw err;
    state.apiEvents = [];
    state.clientEvents = [];
  }
  pruneLocked();
  state.loaded = true;
}

async function persistLocked() {
  const directory = path.dirname(storeFile);
  await fs.mkdir(directory, { recursive: true });
  const tmpPath = `${storeFile}.tmp`;
  const payload = JSON.stringify(
    {
      apiEvents: state.apiEvents,
      clientEvents: state.clientEvents,
    },
    null,
    2
  );
  await fs.writeFile(tmpPath, payload, 'utf8');
  await fs.rename(tmpPath, storeFile);
}

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    runExclusive(async () => {
      await ensureLoadedLocked();
      await persistLocked();
    }).catch(() => {});
  }, 1000);
  if (typeof flushTimer.unref === 'function') flushTimer.unref();
}

function percentile(values, p) {
  if (!Array.isArray(values) || values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  const safeIndex = Math.max(0, Math.min(sorted.length - 1, index));
  return Number(sorted[safeIndex].toFixed(2));
}

function ratioPct(num, den) {
  if (!den) return null;
  return Number(((num / den) * 100).toFixed(2));
}

function aggregateEndpointStats(events) {
  const byEndpoint = new Map();
  for (const event of events) {
    const key = `${event.method} ${event.path}`;
    const existing = byEndpoint.get(key) || {
      method: event.method,
      path: event.path,
      count: 0,
      error_count: 0,
      durations: [],
    };
    existing.count += 1;
    if (event.status >= 500) {
      existing.error_count += 1;
    }
    existing.durations.push(event.duration_ms);
    byEndpoint.set(key, existing);
  }

  return Array.from(byEndpoint.values())
    .map((entry) => ({
      method: entry.method,
      path: entry.path,
      count: entry.count,
      error_count: entry.error_count,
      error_rate_pct: ratioPct(entry.error_count, entry.count) || 0,
      p50_ms: percentile(entry.durations, 50) || 0,
      p95_ms: percentile(entry.durations, 95) || 0,
      p99_ms: percentile(entry.durations, 99) || 0,
    }))
    .sort((a, b) => b.count - a.count);
}

function aggregateCoreKpi(apiEvents, clientEvents) {
  const totalRequests = apiEvents.length;
  const apiErrors = apiEvents.filter((event) => event.status >= 500).length;

  const appOpenEvents = clientEvents.filter((event) => event.name === 'app_open');
  const roundStartEvents = clientEvents.filter((event) => event.name === 'round_start');
  const roundCompleteEvents = clientEvents.filter((event) => event.name === 'round_complete');
  const reportEvents = clientEvents.filter((event) => event.name === 'report_submit');
  const clientErrorEvents = clientEvents.filter((event) => event.name === 'client_error');

  const appSessions = new Set(appOpenEvents.map((event) => event.session_id).filter(Boolean));
  const errorSessions = new Set(clientErrorEvents.map((event) => event.session_id).filter(Boolean));
  const crashFreeSessions =
    appSessions.size > 0 ? Number((((appSessions.size - errorSessions.size) / appSessions.size) * 100).toFixed(2)) : null;

  const reportSuccessCount = reportEvents.filter((event) => event?.properties?.success === true).length;

  const qqLatencies = apiEvents
    .filter((event) => event.path === '/api/quiz-question' && event.method === 'GET')
    .map((event) => event.duration_ms);
  const qsLatencies = apiEvents
    .filter((event) => event.path === '/api/quiz/submit' && event.method === 'POST')
    .map((event) => event.duration_ms);

  return {
    totals: {
      api_requests: totalRequests,
      api_errors: apiErrors,
      app_open: appOpenEvents.length,
      round_start: roundStartEvents.length,
      round_complete: roundCompleteEvents.length,
      report_submit: reportEvents.length,
      report_submit_success: reportSuccessCount,
      client_error: clientErrorEvents.length,
    },
    kpi: {
      api_error_rate_pct: ratioPct(apiErrors, totalRequests),
      activation_rate_pct: ratioPct(roundStartEvents.length, appOpenEvents.length),
      completion_rate_pct: ratioPct(roundCompleteEvents.length, roundStartEvents.length),
      report_success_rate_pct: ratioPct(reportSuccessCount, reportEvents.length),
      crash_free_sessions_pct: crashFreeSessions,
      quiz_question_p95_ms: percentile(qqLatencies, 95),
      quiz_submit_p95_ms: percentile(qsLatencies, 95),
    },
  };
}

export async function recordApiMetric({ method, path, status, duration_ms }) {
  const event = sanitizeApiEvent({ method, path, status, duration_ms });
  await runExclusive(async () => {
    await ensureLoadedLocked();
    state.apiEvents.push(event);
    pruneLocked();
    scheduleFlush();
  });
}

export async function recordClientEvents(events = []) {
  const normalized = Array.isArray(events)
    ? events.map(sanitizeClientEvent).filter((event) => event.name)
    : [];

  if (normalized.length === 0) return 0;

  await runExclusive(async () => {
    await ensureLoadedLocked();
    for (const event of normalized) {
      state.clientEvents.push(event);
    }
    pruneLocked();
    scheduleFlush();
  });

  return normalized.length;
}

export async function recordClientEvent(event) {
  return recordClientEvents([event]);
}

export async function getMetricsDashboard({ windowHours = 24 } = {}) {
  const safeWindowHours = Math.max(1, Math.min(24 * 14, Number(windowHours) || 24));
  return runExclusive(async () => {
    await ensureLoadedLocked();
    pruneLocked();

    const now = Date.now();
    const windowStart = now - safeWindowHours * 60 * 60 * 1000;
    const apiEvents = state.apiEvents.filter((event) => event.ts >= windowStart);
    const clientEvents = state.clientEvents.filter((event) => event.ts >= windowStart);
    const endpoints = aggregateEndpointStats(apiEvents);
    const core = aggregateCoreKpi(apiEvents, clientEvents);

    return {
      generated_at: new Date(now).toISOString(),
      window_hours: safeWindowHours,
      window_start: new Date(windowStart).toISOString(),
      retention_hours: Number(config.metricsRetentionHours),
      core,
      endpoints,
    };
  });
}
