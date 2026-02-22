// server/services/reportsStore.js
// Simple persistent store for user reports (JSON file + retention + IP hashing).

import { createHash, randomUUID } from 'node:crypto';
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

const storeFile = resolveStorePath(config.reportsStoreFile);
const maxEntries = Math.max(100, Number(config.reportsMaxEntries) || 3000);
const retentionMs = Math.max(24 * 60 * 60 * 1000, Number(config.reportsRetentionDays) * 24 * 60 * 60 * 1000);
const ipHashSalt = String(config.reportsIpHashSalt || 'dev-reports-ip-hash-salt');

const state = {
  loaded: false,
  reports: [],
};

let lock = Promise.resolve();

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

function hashIp(ip) {
  if (!ip || String(ip).trim().length === 0) return null;
  return createHash('sha256')
    .update(`${ipHashSalt}:${String(ip).trim()}`)
    .digest('hex')
    .slice(0, 24);
}

function normalizeReport(record) {
  if (!record || typeof record !== 'object') return null;
  const timestamp = typeof record.timestamp === 'string' ? record.timestamp : new Date().toISOString();
  return {
    id: String(record.id || randomUUID()),
    description: String(record.description || '').slice(0, 2000),
    url: String(record.url || '').slice(0, 500),
    userAgent: String(record.userAgent || '').slice(0, 500),
    sourceIpHash: record.sourceIpHash ? String(record.sourceIpHash) : null,
    locale: record.locale ? String(record.locale).slice(0, 12) : null,
    mode: record.mode ? String(record.mode).slice(0, 32) : null,
    route: record.route ? String(record.route).slice(0, 120) : null,
    requestId: record.requestId ? String(record.requestId).slice(0, 120) : null,
    timestamp,
  };
}

function pruneReports(list, now = Date.now()) {
  const cutoff = now - retentionMs;
  const kept = list.filter((item) => {
    const ts = Date.parse(item.timestamp);
    if (!Number.isFinite(ts)) return false;
    return ts >= cutoff;
  });
  if (kept.length > maxEntries) {
    kept.length = maxEntries;
  }
  return kept;
}

async function ensureLoadedLocked() {
  if (state.loaded) return;
  try {
    const raw = await fs.readFile(storeFile, 'utf8');
    const parsed = safeJsonParse(raw, { reports: [] });
    const records = Array.isArray(parsed?.reports) ? parsed.reports : [];
    state.reports = pruneReports(records.map(normalizeReport).filter(Boolean));
  } catch (err) {
    if (err?.code !== 'ENOENT') {
      throw err;
    }
    state.reports = [];
  }
  state.loaded = true;
}

async function persistLocked() {
  const directory = path.dirname(storeFile);
  await fs.mkdir(directory, { recursive: true });
  const tmpPath = `${storeFile}.tmp`;
  const payload = JSON.stringify({ reports: state.reports }, null, 2);
  await fs.writeFile(tmpPath, payload, 'utf8');
  await fs.rename(tmpPath, storeFile);
}

export async function addReport({
  description,
  url,
  userAgent,
  sourceIp,
  locale,
  mode,
  route,
  requestId,
}) {
  return runExclusive(async () => {
    await ensureLoadedLocked();
    state.reports = pruneReports(state.reports);

    const report = normalizeReport({
      id: randomUUID(),
      description,
      url,
      userAgent,
      sourceIpHash: hashIp(sourceIp),
      locale,
      mode,
      route,
      requestId,
      timestamp: new Date().toISOString(),
    });
    state.reports.unshift(report);
    if (state.reports.length > maxEntries) {
      state.reports.length = maxEntries;
    }
    await persistLocked();
    return report;
  });
}

export async function listReports() {
  return runExclusive(async () => {
    await ensureLoadedLocked();
    const before = state.reports.length;
    state.reports = pruneReports(state.reports);
    if (state.reports.length !== before) {
      await persistLocked();
    }
    return state.reports.map((item) => ({ ...item }));
  });
}

export async function getReportsCount() {
  return runExclusive(async () => {
    await ensureLoadedLocked();
    return state.reports.length;
  });
}
