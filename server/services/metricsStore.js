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

function sanitizeApiTags(tags) {
  if (!tags || typeof tags !== 'object') return {};
  const allowedKeys = ['pack_id', 'game_mode', 'media_type', 'locale', 'round_action'];
  const out = {};
  for (const key of allowedKeys) {
    const value = tags[key];
    if (value == null) continue;
    out[key] = String(value).slice(0, 80);
  }
  return out;
}

function sanitizeApiEvent(event) {
  const ts = Number(event?.ts) || Date.now();
  return {
    ts,
    method: String(event?.method || 'GET').slice(0, 12).toUpperCase(),
    path: normalizeApiPath(event?.path),
    status: Number.parseInt(String(event?.status ?? 0), 10) || 0,
    duration_ms: Math.max(0, Number(event?.duration_ms) || 0),
    tags: sanitizeApiTags(event?.tags),
  };
}

function sanitizeClientEvent(event) {
  const ts = Number(event?.ts) || Date.now();
  const properties = event?.properties && typeof event.properties === 'object' ? event.properties : {};
  return {
    ts,
    name: String(event?.name || '').slice(0, 64),
    session_id: event?.session_id ? String(event.session_id).slice(0, 120) : null,
    anon_user_id: event?.anon_user_id ? String(event.anon_user_id).slice(0, 120) : null,
    properties,
  };
}

function getEventUserId(event) {
  if (!event || typeof event !== 'object') return null;
  if (event.anon_user_id) return String(event.anon_user_id);
  if (event.session_id) return String(event.session_id);
  return null;
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
  const playClickEvents = clientEvents.filter((event) => event.name === 'play_click');
  const questionViewEvents = clientEvents.filter((event) => event.name === 'question_view');
  const answerSubmitEvents = clientEvents.filter((event) => event.name === 'answer_submit');
  const quitMidRoundEvents = clientEvents.filter((event) => event.name === 'quit_mid_round');
  const roundStartEvents = clientEvents.filter((event) => event.name === 'round_start');
  const roundCompleteEvents = clientEvents.filter((event) => event.name === 'round_complete');
  const reportEvents = clientEvents.filter((event) => event.name === 'report_submit');
  const clientErrorEvents = clientEvents.filter((event) => event.name === 'client_error');
  const apiErrorEvents = clientEvents.filter((event) => event.name === 'api_error');

  const appSessions = new Set(appOpenEvents.map(getEventUserId).filter(Boolean));
  const errorSessions = new Set(clientErrorEvents.map(getEventUserId).filter(Boolean));
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
      play_click: playClickEvents.length,
      question_view: questionViewEvents.length,
      answer_submit: answerSubmitEvents.length,
      quit_mid_round: quitMidRoundEvents.length,
      round_start: roundStartEvents.length,
      round_complete: roundCompleteEvents.length,
      report_submit: reportEvents.length,
      report_submit_success: reportSuccessCount,
      client_error: clientErrorEvents.length,
      api_error_events: apiErrorEvents.length,
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

function toFiniteNumber(value) {
  const parsed = Number.parseFloat(String(value ?? ''));
  return Number.isFinite(parsed) ? parsed : null;
}

function toBoolean(value) {
  if (value === true || value === false) return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
    if (['false', '0', 'no', 'off'].includes(normalized)) return false;
  }
  return null;
}

function normalizePackId(raw) {
  if (raw == null) return 'unknown';
  const value = String(raw).trim();
  return value.length > 0 ? value.slice(0, 80) : 'unknown';
}

function getQuestionIndex(event) {
  const value = toFiniteNumber(event?.properties?.question_index);
  return value && value > 0 ? Math.round(value) : null;
}

function toUtcHourKey(ts) {
  const date = new Date(Number(ts) || Date.now());
  date.setUTCMinutes(0, 0, 0);
  return date.toISOString();
}

function toUtcDayKey(ts) {
  const date = new Date(Number(ts) || Date.now());
  date.setUTCHours(0, 0, 0, 0);
  return date.toISOString();
}

function parseUtcDayMs(ts) {
  const date = new Date(Number(ts) || Date.now());
  date.setUTCHours(0, 0, 0, 0);
  return date.getTime();
}

function levelBucket(level) {
  const safeLevel = Math.max(1, Math.floor(Number(level) || 1));
  if (safeLevel <= 5) return '1-5';
  if (safeLevel <= 10) return '6-10';
  if (safeLevel <= 20) return '11-20';
  if (safeLevel <= 30) return '21-30';
  return '31+';
}

function sortObjectCountDesc(obj = {}) {
  return Object.entries(obj)
    .map(([key, count]) => ({ key, count: Number(count) || 0 }))
    .sort((a, b) => b.count - a.count);
}

function computeAbandonment(clientEvents) {
  const quitEvents = clientEvents.filter((event) => event.name === 'quit_mid_round');
  const questionIndices = quitEvents.map(getQuestionIndex).filter((value) => Number.isFinite(value));

  const byMode = {};
  const byPack = {};
  for (const event of quitEvents) {
    const mode = String(event?.properties?.mode || 'unknown');
    const packId = normalizePackId(event?.properties?.pack_id);
    byMode[mode] = (byMode[mode] || 0) + 1;
    byPack[packId] = (byPack[packId] || 0) + 1;
  }

  return {
    quit_count: quitEvents.length,
    avg_question_index: questionIndices.length
      ? Number((questionIndices.reduce((sum, value) => sum + value, 0) / questionIndices.length).toFixed(2))
      : null,
    p50_question_index: percentile(questionIndices, 50),
    p90_question_index: percentile(questionIndices, 90),
    by_mode: sortObjectCountDesc(byMode),
    by_pack: sortObjectCountDesc(byPack).slice(0, 20),
  };
}

function computePackHealth(apiEvents, clientEvents) {
  const map = new Map();
  const ensure = (packIdRaw) => {
    const packId = normalizePackId(packIdRaw);
    if (!map.has(packId)) {
      map.set(packId, {
        pack_id: packId,
        round_start: 0,
        round_complete: 0,
        round_success: 0,
        report_submit: 0,
        quiz_question_durations: [],
      });
    }
    return map.get(packId);
  };

  for (const event of clientEvents) {
    const packId = event?.properties?.pack_id;
    if (event.name === 'round_start') {
      ensure(packId).round_start += 1;
    } else if (event.name === 'round_complete') {
      const row = ensure(packId);
      row.round_complete += 1;
      if (toBoolean(event?.properties?.success) === true) {
        row.round_success += 1;
      }
    } else if (event.name === 'report_submit') {
      ensure(packId).report_submit += 1;
    }
  }

  for (const event of apiEvents) {
    if (event.path !== '/api/quiz-question' || event.method !== 'GET') continue;
    const packId = event?.tags?.pack_id;
    ensure(packId).quiz_question_durations.push(event.duration_ms);
  }

  return Array.from(map.values())
    .map((row) => ({
      pack_id: row.pack_id,
      round_start: row.round_start,
      round_complete: row.round_complete,
      completion_rate_pct: ratioPct(row.round_complete, row.round_start),
      accuracy_pct: ratioPct(row.round_success, row.round_complete),
      report_submit: row.report_submit,
      report_rate_pct: ratioPct(row.report_submit, row.round_start),
      quiz_question_count: row.quiz_question_durations.length,
      quiz_question_p95_ms: percentile(row.quiz_question_durations, 95),
    }))
    .sort((a, b) => b.round_start - a.round_start);
}

function computeDifficultyFairness(clientEvents) {
  const completed = clientEvents.filter((event) => event.name === 'round_complete');
  const byMode = new Map();
  const byModePack = new Map();
  const byLevelBucket = new Map();

  const increment = (map, key, isSuccess) => {
    const existing = map.get(key) || { total: 0, success: 0 };
    existing.total += 1;
    if (isSuccess) existing.success += 1;
    map.set(key, existing);
  };

  for (const event of completed) {
    const mode = String(event?.properties?.mode || 'unknown');
    const packId = normalizePackId(event?.properties?.pack_id);
    const isSuccess = toBoolean(event?.properties?.success) === true;
    increment(byMode, mode, isSuccess);
    increment(byModePack, `${mode}::${packId}`, isSuccess);

    const playerLevel = toFiniteNumber(event?.properties?.player_level);
    if (playerLevel != null) {
      increment(byLevelBucket, levelBucket(playerLevel), isSuccess);
    }
  }

  return {
    by_mode: Array.from(byMode.entries())
      .map(([mode, stats]) => ({
        mode,
        rounds: stats.total,
        success_rate_pct: ratioPct(stats.success, stats.total),
      }))
      .sort((a, b) => b.rounds - a.rounds),
    by_mode_pack: Array.from(byModePack.entries())
      .map(([key, stats]) => {
        const [mode, pack_id] = key.split('::');
        return {
          mode,
          pack_id,
          rounds: stats.total,
          success_rate_pct: ratioPct(stats.success, stats.total),
        };
      })
      .sort((a, b) => b.rounds - a.rounds)
      .slice(0, 50),
    by_level_bucket: Array.from(byLevelBucket.entries())
      .map(([bucket, stats]) => ({
        level_bucket: bucket,
        rounds: stats.total,
        success_rate_pct: ratioPct(stats.success, stats.total),
      }))
      .sort((a, b) => a.level_bucket.localeCompare(b.level_bucket)),
  };
}

function computeExplainValue(clientEvents) {
  const openEvents = clientEvents.filter((event) => event.name === 'explanation_open');
  const feedbackEvents = clientEvents.filter((event) => event.name === 'explanation_feedback');
  const usefulCount = feedbackEvents.filter((event) => toBoolean(event?.properties?.useful) === true).length;
  const notUsefulCount = feedbackEvents.filter((event) => toBoolean(event?.properties?.useful) === false).length;

  return {
    explanation_open: openEvents.length,
    feedback_total: feedbackEvents.length,
    useful_count: usefulCount,
    not_useful_count: notUsefulCount,
    useful_rate_pct: ratioPct(usefulCount, feedbackEvents.length),
  };
}

function computeReliability(apiEvents, clientEvents) {
  const apiErrors = apiEvents.filter((event) => event.status >= 500);
  const apiErrorGroups = new Map();
  for (const event of apiErrors) {
    const key = `${event.method} ${event.path} (${event.status})`;
    const row = apiErrorGroups.get(key) || { key, count: 0, durations: [] };
    row.count += 1;
    row.durations.push(event.duration_ms);
    apiErrorGroups.set(key, row);
  }

  const clientErrorEvents = clientEvents.filter(
    (event) => event.name === 'client_error' || event.name === 'api_error'
  );
  const clientErrorGroups = new Map();
  for (const event of clientErrorEvents) {
    const name = event.name;
    const source = String(event?.properties?.source || '');
    const endpoint = String(event?.properties?.endpoint || '');
    const code = String(event?.properties?.code || '');
    const status = String(event?.properties?.status || '');
    const message = String(event?.properties?.message || '');
    const key = [name, source || endpoint, code || status || message].filter(Boolean).join(' :: ').slice(0, 220) || name;
    clientErrorGroups.set(key, (clientErrorGroups.get(key) || 0) + 1);
  }

  const usersWithError = new Set(
    clientErrorEvents.map(getEventUserId).filter(Boolean)
  );
  const quitUsers = new Set(
    clientEvents.filter((event) => event.name === 'quit_mid_round').map(getEventUserId).filter(Boolean)
  );
  const allUsers = new Set(clientEvents.map(getEventUserId).filter(Boolean));

  const errorAndQuit = new Set([...usersWithError].filter((userId) => quitUsers.has(userId)));
  const usersWithoutError = new Set([...allUsers].filter((userId) => !usersWithError.has(userId)));
  const usersWithoutErrorAndQuit = new Set([...usersWithoutError].filter((userId) => quitUsers.has(userId)));

  return {
    top_api_errors: Array.from(apiErrorGroups.values())
      .map((row) => ({
        key: row.key,
        count: row.count,
        p95_ms: percentile(row.durations, 95),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20),
    top_client_errors: Array.from(clientErrorGroups.entries())
      .map(([key, count]) => ({ key, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20),
    abandonment_impact: {
      users_with_error: usersWithError.size,
      users_with_error_and_quit: errorAndQuit.size,
      quit_rate_with_error_pct: ratioPct(errorAndQuit.size, usersWithError.size),
      users_without_error: usersWithoutError.size,
      users_without_error_and_quit: usersWithoutErrorAndQuit.size,
      quit_rate_without_error_pct: ratioPct(usersWithoutErrorAndQuit.size, usersWithoutError.size),
    },
  };
}

function computePerformanceByHour(apiEvents, clientEvents) {
  const byHour = new Map();
  const ensure = (hourKey) => {
    if (!byHour.has(hourKey)) {
      byHour.set(hourKey, {
        hour: hourKey,
        qqDurations: [],
        roundStart: 0,
        roundComplete: 0,
      });
    }
    return byHour.get(hourKey);
  };

  for (const event of apiEvents) {
    if (event.path !== '/api/quiz-question' || event.method !== 'GET') continue;
    const hourKey = toUtcHourKey(event.ts);
    ensure(hourKey).qqDurations.push(event.duration_ms);
  }

  for (const event of clientEvents) {
    if (event.name !== 'round_start' && event.name !== 'round_complete') continue;
    const hourKey = toUtcHourKey(event.ts);
    const row = ensure(hourKey);
    if (event.name === 'round_start') row.roundStart += 1;
    if (event.name === 'round_complete') row.roundComplete += 1;
  }

  return Array.from(byHour.values())
    .map((row) => ({
      hour: row.hour,
      quiz_question_count: row.qqDurations.length,
      quiz_question_p95_ms: percentile(row.qqDurations, 95),
      round_start: row.roundStart,
      round_complete: row.roundComplete,
      completion_rate_pct: ratioPct(row.roundComplete, row.roundStart),
    }))
    .sort((a, b) => String(a.hour).localeCompare(String(b.hour)));
}

function computeAiCost(clientEvents) {
  const usageEvents = clientEvents.filter((event) => event.name === 'ai_usage');
  const PRICE_INPUT_PER_1M = 0.3;
  const PRICE_OUTPUT_PER_1M = 2.5;

  let promptTokens = 0;
  let outputTokens = 0;
  let totalTokens = 0;
  let totalCostUsd = 0;

  const perDay = new Map();
  const perSession = new Map();

  for (const event of usageEvents) {
    const prompt = Math.max(0, toFiniteNumber(event?.properties?.prompt_tokens) || 0);
    const output = Math.max(0, toFiniteNumber(event?.properties?.candidate_tokens) || 0);
    const total = Math.max(0, toFiniteNumber(event?.properties?.total_tokens) || prompt + output);
    const estimatedCost =
      toFiniteNumber(event?.properties?.estimated_cost_usd) ??
      (prompt * PRICE_INPUT_PER_1M + output * PRICE_OUTPUT_PER_1M) / 1_000_000;

    promptTokens += prompt;
    outputTokens += output;
    totalTokens += total;
    totalCostUsd += estimatedCost;

    const dayKey = toUtcDayKey(event.ts);
    const dayRow = perDay.get(dayKey) || { date: dayKey, explain_calls: 0, estimated_cost_usd: 0 };
    dayRow.explain_calls += 1;
    dayRow.estimated_cost_usd += estimatedCost;
    perDay.set(dayKey, dayRow);

    if (event.session_id) {
      const sessionRow = perSession.get(event.session_id) || { session_id: event.session_id, explain_calls: 0, estimated_cost_usd: 0 };
      sessionRow.explain_calls += 1;
      sessionRow.estimated_cost_usd += estimatedCost;
      perSession.set(event.session_id, sessionRow);
    }
  }

  return {
    explain_calls: usageEvents.length,
    prompt_tokens: promptTokens,
    candidate_tokens: outputTokens,
    total_tokens: totalTokens,
    estimated_cost_usd: Number(totalCostUsd.toFixed(6)),
    estimated_cost_per_explain_usd: usageEvents.length > 0 ? Number((totalCostUsd / usageEvents.length).toFixed(6)) : null,
    estimated_cost_per_session_usd:
      perSession.size > 0
        ? Number(
            (
              Array.from(perSession.values()).reduce((sum, row) => sum + row.estimated_cost_usd, 0) /
              perSession.size
            ).toFixed(6)
          )
        : null,
    per_day: Array.from(perDay.values())
      .map((row) => ({
        ...row,
        estimated_cost_usd: Number(row.estimated_cost_usd.toFixed(6)),
      }))
      .sort((a, b) => String(a.date).localeCompare(String(b.date))),
  };
}

function computeGrowth(clientEvents) {
  const appOpenEvents = clientEvents.filter((event) => event.name === 'app_open');
  const utmSource = {};
  const utmMedium = {};
  const utmCampaign = {};
  const referrerHost = {};

  for (const event of appOpenEvents) {
    const source = String(event?.properties?.utm_source || 'direct').trim() || 'direct';
    const medium = String(event?.properties?.utm_medium || 'unknown').trim() || 'unknown';
    const campaign = String(event?.properties?.utm_campaign || 'none').trim() || 'none';
    const referrer = String(event?.properties?.referrer_host || 'none').trim() || 'none';

    utmSource[source] = (utmSource[source] || 0) + 1;
    utmMedium[medium] = (utmMedium[medium] || 0) + 1;
    utmCampaign[campaign] = (utmCampaign[campaign] || 0) + 1;
    referrerHost[referrer] = (referrerHost[referrer] || 0) + 1;
  }

  return {
    app_open: appOpenEvents.length,
    utm_source: sortObjectCountDesc(utmSource),
    utm_medium: sortObjectCountDesc(utmMedium),
    utm_campaign: sortObjectCountDesc(utmCampaign),
    referrer_host: sortObjectCountDesc(referrerHost),
  };
}

function computeRetention(clientEvents, nowTs) {
  const byUser = new Map();

  for (const event of clientEvents) {
    const userId = getEventUserId(event);
    if (!userId) continue;
    const existing = byUser.get(userId) || { firstOpenTs: null, activityDays: new Set() };
    if (event.name === 'app_open') {
      existing.firstOpenTs = existing.firstOpenTs == null
        ? event.ts
        : Math.min(existing.firstOpenTs, event.ts);
    }
    existing.activityDays.add(parseUtcDayMs(event.ts));
    byUser.set(userId, existing);
  }

  const computeRateForDay = (dayOffset) => {
    let eligible = 0;
    let retained = 0;
    for (const data of byUser.values()) {
      if (!Number.isFinite(data.firstOpenTs)) continue;
      if (nowTs - data.firstOpenTs < dayOffset * 24 * 60 * 60 * 1000) continue;
      eligible += 1;
      const firstDay = parseUtcDayMs(data.firstOpenTs);
      const targetDay = firstDay + dayOffset * 24 * 60 * 60 * 1000;
      if (data.activityDays.has(targetDay)) retained += 1;
    }
    return {
      eligible_users: eligible,
      retained_users: retained,
      retention_rate_pct: ratioPct(retained, eligible),
    };
  };

  return {
    cohort_users: Array.from(byUser.values()).filter((row) => Number.isFinite(row.firstOpenTs)).length,
    d1: computeRateForDay(1),
    d3: computeRateForDay(3),
    d7: computeRateForDay(7),
  };
}

function computeFeedbackQuality(clientEvents) {
  const reports = clientEvents.filter((event) => event.name === 'report_submit');
  const successCount = reports.filter((event) => toBoolean(event?.properties?.success) === true).length;
  const resolvedCount = reports.filter((event) => {
    const resolved = toBoolean(event?.properties?.resolved);
    const fixed = toBoolean(event?.properties?.fixed);
    return resolved === true || fixed === true;
  }).length;
  const categories = {};
  for (const event of reports) {
    const category =
      String(
        event?.properties?.category ||
          event?.properties?.reason ||
          event?.properties?.code ||
          (toBoolean(event?.properties?.success) === true ? 'success' : 'uncategorized')
      ).trim() || 'uncategorized';
    categories[category] = (categories[category] || 0) + 1;
  }

  return {
    report_submit: reports.length,
    report_submit_success: successCount,
    report_success_rate_pct: ratioPct(successCount, reports.length),
    categories: sortObjectCountDesc(categories),
    report_resolved: resolvedCount,
    correction_rate_pct: ratioPct(resolvedCount, reports.length),
  };
}

function buildAnalysisSnapshot(apiEvents, clientEvents, nowTs) {
  return {
    funnels: {
      activation: {
        app_open: clientEvents.filter((event) => event.name === 'app_open').length,
        round_start: clientEvents.filter((event) => event.name === 'round_start').length,
        activation_rate_pct: ratioPct(
          clientEvents.filter((event) => event.name === 'round_start').length,
          clientEvents.filter((event) => event.name === 'app_open').length
        ),
      },
      completion: {
        round_start: clientEvents.filter((event) => event.name === 'round_start').length,
        round_complete: clientEvents.filter((event) => event.name === 'round_complete').length,
        completion_rate_pct: ratioPct(
          clientEvents.filter((event) => event.name === 'round_complete').length,
          clientEvents.filter((event) => event.name === 'round_start').length
        ),
      },
    },
    abandonment: computeAbandonment(clientEvents),
    pack_health: computePackHealth(apiEvents, clientEvents),
    difficulty_fairness: computeDifficultyFairness(clientEvents),
    explain_value: computeExplainValue(clientEvents),
    reliability: computeReliability(apiEvents, clientEvents),
    performance_by_hour: computePerformanceByHour(apiEvents, clientEvents),
    ai_cost: computeAiCost(clientEvents),
    growth: computeGrowth(clientEvents),
    retention: computeRetention(clientEvents, nowTs),
    feedback_quality: computeFeedbackQuality(clientEvents),
  };
}

export async function recordApiMetric({ method, path, status, duration_ms, tags }) {
  const event = sanitizeApiEvent({ method, path, status, duration_ms, tags });
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
    const analysis = buildAnalysisSnapshot(apiEvents, clientEvents, now);

    return {
      generated_at: new Date(now).toISOString(),
      window_hours: safeWindowHours,
      window_start: new Date(windowStart).toISOString(),
      retention_hours: Number(config.metricsRetentionHours),
      core,
      endpoints,
      analysis,
    };
  });
}
