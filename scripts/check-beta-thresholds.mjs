#!/usr/bin/env node

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const HISTORY_RETENTION_DAYS = 30;
const HOUR_GAP_TOLERANCE_MS = 5 * 60 * 1000;

function resolveProjectPath(targetPath) {
  if (path.isAbsolute(targetPath)) return targetPath;
  return path.resolve(projectRoot, targetPath);
}

function parseFloatEnv(name, fallback) {
  const parsed = Number.parseFloat(String(process.env[name] ?? ''));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseIntEnv(name, fallback) {
  const parsed = Number.parseInt(String(process.env[name] ?? ''), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const thresholds = {
  api_error_rate_pct: {
    label: 'API error rate (%)',
    op: 'max',
    target: parseFloatEnv('BETA_API_ERROR_RATE_MAX', 1.5),
    sampleRef: { source: 'totals', key: 'api_requests' },
    minSamples72h: parseIntEnv('BETA_MIN_API_REQUESTS_72H', 120),
    minSamples1h: parseIntEnv('BETA_MIN_API_REQUESTS_1H', 1),
    streak: true,
  },
  crash_free_sessions_pct: {
    label: 'Crash-free sessions (%)',
    op: 'min',
    target: parseFloatEnv('BETA_CRASH_FREE_MIN', 99),
    sampleRef: { source: 'totals', key: 'app_open' },
    minSamples72h: parseIntEnv('BETA_MIN_APP_OPEN_72H', 50),
    minSamples1h: parseIntEnv('BETA_MIN_APP_OPEN_1H', 1),
    streak: false,
  },
  report_success_rate_pct: {
    label: 'Report success rate (%)',
    op: 'min',
    target: parseFloatEnv('BETA_REPORT_SUCCESS_MIN', 95),
    sampleRef: { source: 'totals', key: 'report_submit' },
    minSamples72h: parseIntEnv('BETA_MIN_REPORT_SUBMIT_72H', 5),
    minSamples1h: parseIntEnv('BETA_MIN_REPORT_SUBMIT_1H', 1),
    streak: false,
  },
  activation_rate_pct: {
    label: 'Activation rate (%)',
    op: 'min',
    target: parseFloatEnv('BETA_ACTIVATION_MIN', 70),
    sampleRef: { source: 'totals', key: 'app_open' },
    minSamples72h: parseIntEnv('BETA_MIN_APP_OPEN_72H', 50),
    minSamples1h: parseIntEnv('BETA_MIN_APP_OPEN_1H', 1),
    streak: false,
  },
  completion_rate_pct: {
    label: 'Round completion rate (%)',
    op: 'min',
    target: parseFloatEnv('BETA_COMPLETION_MIN', 65),
    sampleRef: { source: 'totals', key: 'round_start' },
    minSamples72h: parseIntEnv('BETA_MIN_ROUND_START_72H', 50),
    minSamples1h: parseIntEnv('BETA_MIN_ROUND_START_1H', 1),
    streak: false,
  },
  quiz_question_p95_ms: {
    label: 'quiz-question p95 (ms)',
    op: 'max',
    target: parseFloatEnv('BETA_QUIZ_QUESTION_P95_MAX_MS', 900),
    sampleRef: { source: 'endpoints', method: 'GET', path: '/api/quiz-question' },
    minSamples72h: parseIntEnv('BETA_MIN_QUIZ_QUESTION_72H', 50),
    minSamples1h: parseIntEnv('BETA_MIN_QUIZ_QUESTION_1H', 1),
    streak: true,
  },
  quiz_submit_p95_ms: {
    label: 'quiz-submit p95 (ms)',
    op: 'max',
    target: parseFloatEnv('BETA_QUIZ_SUBMIT_P95_MAX_MS', 700),
    sampleRef: { source: 'endpoints', method: 'POST', path: '/api/quiz/submit' },
    minSamples72h: parseIntEnv('BETA_MIN_QUIZ_SUBMIT_72H', 50),
    minSamples1h: parseIntEnv('BETA_MIN_QUIZ_SUBMIT_1H', 1),
    streak: true,
  },
};

const metricsBaseUrl = String(process.env.METRICS_BASE_URL || 'http://localhost:3001').replace(/\/+$/, '');
const metricsDashboardToken = String(process.env.METRICS_DASHBOARD_TOKEN || '').trim();
const require72hStreak = String(process.env.BETA_REQUIRE_72H || 'true').toLowerCase() !== 'false';
const historyFile = resolveProjectPath(
  process.env.BETA_THRESHOLDS_HISTORY_FILE || 'server/data/beta-thresholds-history.json'
);

function formatNumber(value) {
  if (!Number.isFinite(value)) return 'n/a';
  return Number(value.toFixed(2)).toString();
}

function getEndpointCount(snapshot, method, pathValue) {
  const endpoints = Array.isArray(snapshot?.endpoints) ? snapshot.endpoints : [];
  const found = endpoints.find(
    (entry) => String(entry?.method || '').toUpperCase() === String(method || '').toUpperCase()
      && String(entry?.path || '') === String(pathValue || '')
  );
  const count = Number.parseInt(String(found?.count ?? ''), 10);
  return Number.isFinite(count) ? count : 0;
}

function getSampleCount(snapshot, sampleRef) {
  if (!sampleRef || typeof sampleRef !== 'object') return null;
  if (sampleRef.source === 'totals') {
    const raw = snapshot?.core?.totals?.[sampleRef.key];
    const count = Number.parseInt(String(raw ?? ''), 10);
    return Number.isFinite(count) ? count : 0;
  }
  if (sampleRef.source === 'endpoints') {
    return getEndpointCount(snapshot, sampleRef.method, sampleRef.path);
  }
  return null;
}

function evaluateKpi(snapshot = {}, { windowHours = 72, onlyStreak = false } = {}) {
  const kpi = snapshot?.core?.kpi || {};
  const entries = Object.entries(thresholds).filter(([, rule]) => !onlyStreak || rule.streak);

  const checks = entries.map(([key, rule]) => {
    const value = Number.parseFloat(String(kpi?.[key] ?? ''));
    const hasValue = Number.isFinite(value);
    const minSamples = windowHours <= 1 ? Math.max(0, Number(rule.minSamples1h) || 0) : Math.max(0, Number(rule.minSamples72h) || 0);
    const sampleCount = getSampleCount(snapshot, rule.sampleRef);
    const enoughSamples = sampleCount === null ? true : sampleCount >= minSamples;
    const pass = hasValue
      ? rule.op === 'min'
        ? value >= rule.target
        : value < rule.target
      : false;

    let status = 'insufficient';
    if (enoughSamples && hasValue) {
      status = pass ? 'pass' : 'fail';
    }

    return {
      key,
      label: rule.label,
      op: rule.op,
      target: rule.target,
      value: hasValue ? value : null,
      sampleCount,
      minSamples,
      streak: Boolean(rule.streak),
      status,
    };
  });

  const failed = checks.filter((check) => check.status === 'fail').length;
  const insufficient = checks.filter((check) => check.status === 'insufficient').length;
  const status = failed > 0 ? 'fail' : insufficient > 0 ? 'insufficient' : 'pass';

  return { status, checks };
}

function formatCheckLine(check) {
  const comparator = check.op === 'min' ? '>=' : '<';
  const state =
    check.status === 'pass'
      ? 'PASS'
      : check.status === 'fail'
        ? 'FAIL'
        : 'NODATA';
  const sampleInfo =
    Number.isFinite(check.sampleCount) && Number.isFinite(check.minSamples)
      ? `, samples ${check.sampleCount}/${check.minSamples}`
      : '';
  return `${state.padEnd(6)} ${check.label}: ${formatNumber(check.value)} (target ${comparator} ${check.target}${sampleInfo})`;
}

async function fetchDashboard(windowHours) {
  const url = new URL('/api/metrics/dashboard', metricsBaseUrl);
  url.searchParams.set('window_hours', String(windowHours));

  const headers = { Accept: 'application/json' };
  if (metricsDashboardToken) {
    headers.Authorization = `Bearer ${metricsDashboardToken}`;
  }

  const res = await fetch(url, { headers });
  let payload = null;
  try {
    payload = await res.json();
  } catch {
    payload = null;
  }

  if (!res.ok) {
    const code = payload?.error?.code || 'UNKNOWN';
    const message = payload?.error?.message || `HTTP ${res.status}`;
    throw new Error(`Dashboard request failed (${res.status} ${code}): ${message}`);
  }
  return payload;
}

async function readHistory() {
  try {
    const raw = await fs.readFile(historyFile, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    if (err?.code === 'ENOENT') return [];
    throw err;
  }
}

function normalizeHistory(entries) {
  const normalized = [];
  for (const entry of entries) {
    if (!entry || typeof entry !== 'object') continue;
    const bucketTs = Number.parseInt(String(entry.bucketTs ?? ''), 10);
    if (!Number.isFinite(bucketTs)) continue;
    if (!['pass', 'fail', 'insufficient'].includes(entry.status)) continue;
    normalized.push({
      bucketTs,
      status: entry.status,
      ts: typeof entry.ts === 'string' ? entry.ts : new Date(bucketTs).toISOString(),
    });
  }

  normalized.sort((a, b) => a.bucketTs - b.bucketTs);

  const byBucket = new Map();
  for (const entry of normalized) {
    byBucket.set(entry.bucketTs, entry);
  }
  return Array.from(byBucket.values()).sort((a, b) => a.bucketTs - b.bucketTs);
}

async function writeHistory(entries) {
  const folder = path.dirname(historyFile);
  await fs.mkdir(folder, { recursive: true });
  const tmp = `${historyFile}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(entries, null, 2), 'utf8');
  await fs.rename(tmp, historyFile);
}

function currentHourBucketTs(now = Date.now()) {
  return Math.floor(now / HOUR_MS) * HOUR_MS;
}

function computeConsecutivePassHours(entries) {
  if (!Array.isArray(entries) || entries.length === 0) return 0;
  let streak = 0;
  let expectedNextBucketTs = null;
  let encounteredPass = false;

  for (let i = entries.length - 1; i >= 0; i -= 1) {
    const entry = entries[i];
    if (expectedNextBucketTs !== null) {
      const diff = expectedNextBucketTs - entry.bucketTs;
      const min = HOUR_MS - HOUR_GAP_TOLERANCE_MS;
      const max = HOUR_MS + HOUR_GAP_TOLERANCE_MS;
      if (diff < min || diff > max) break;
    }
    if (entry.status === 'fail') {
      if (!encounteredPass) return 0;
      break;
    }
    if (entry.status === 'pass') {
      streak += 1;
      encounteredPass = true;
    }
    expectedNextBucketTs = entry.bucketTs;
  }

  return streak;
}

function printWindowSummary(windowLabel, snapshot, evaluation) {
  console.log(`\n[${windowLabel}]`);
  console.log(`Generated at: ${snapshot?.generated_at || 'n/a'}`);
  console.log(`Status: ${evaluation.status.toUpperCase()}`);
  for (const check of evaluation.checks) {
    console.log(`- ${formatCheckLine(check)}`);
  }
}

async function main() {
  const snapshot72h = await fetchDashboard(72);
  const snapshot1h = await fetchDashboard(1);

  const eval72h = evaluateKpi(snapshot72h, { windowHours: 72 });
  const eval1h = evaluateKpi(snapshot1h, { windowHours: 1 });
  const evalStreak1h = evaluateKpi(snapshot1h, { windowHours: 1, onlyStreak: true });
  const streakCheckLabels = Object.values(thresholds)
    .filter((rule) => rule.streak)
    .map((rule) => rule.label);

  const now = Date.now();
  const currentBucket = currentHourBucketTs(now);
  const retentionCutoff = now - HISTORY_RETENTION_DAYS * DAY_MS;

  const history = normalizeHistory(await readHistory()).filter(
    (entry) => entry.bucketTs >= retentionCutoff && entry.bucketTs <= currentBucket + HOUR_MS
  );

  const currentEntry = {
    bucketTs: currentBucket,
    ts: new Date(now).toISOString(),
    status: evalStreak1h.status,
  };

  const existingIndex = history.findIndex((entry) => entry.bucketTs === currentBucket);
  if (existingIndex >= 0) {
    history[existingIndex] = currentEntry;
  } else {
    history.push(currentEntry);
    history.sort((a, b) => a.bucketTs - b.bucketTs);
  }

  await writeHistory(history);

  const consecutivePassHours = computeConsecutivePassHours(history);
  const has72hStreak = consecutivePassHours >= 72;
  const kpiWindowPass = eval72h.status === 'pass';
  const finalPass = kpiWindowPass && (!require72hStreak || has72hStreak);

  console.log('Beta readiness gate');
  console.log(`Metrics API: ${metricsBaseUrl}`);
  console.log(`History file: ${historyFile}`);

  printWindowSummary('72h KPI window', snapshot72h, eval72h);
  printWindowSummary('1h KPI window (current bucket, all checks)', snapshot1h, eval1h);
  printWindowSummary('1h Stability window (streak checks)', snapshot1h, evalStreak1h);

  console.log('\n[Consecutive streak]');
  console.log(`Streak checks: ${streakCheckLabels.join(', ')}`);
  console.log(`Consecutive passing hours: ${consecutivePassHours}`);
  console.log(`72h streak required: ${require72hStreak ? 'yes' : 'no'}`);
  if (require72hStreak) {
    console.log(`72h streak reached: ${has72hStreak ? 'yes' : 'no'}`);
  }

  console.log('\n[Result]');
  console.log(`Window pass (72h): ${kpiWindowPass ? 'yes' : 'no'}`);
  console.log(`Current 1h stability status: ${evalStreak1h.status.toUpperCase()}`);
  console.log(`Final gate: ${finalPass ? 'GREEN' : 'RED'}`);

  if (!finalPass) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(`Failed to evaluate beta thresholds: ${err.message}`);
  process.exitCode = 2;
});
