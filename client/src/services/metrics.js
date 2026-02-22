// src/services/metrics.js
// First-party client metrics transport (no third-party tracker).

const CLIENT_SESSION_ID_KEY = 'inaturamouche_client_session_id';
const METRICS_SESSION_ID_KEY = 'inaturamouche_metrics_session_id';

const runtimeEnv = typeof import.meta !== 'undefined' ? import.meta.env || {} : {};
const API_BASE_URL =
  runtimeEnv.VITE_API_URL ||
  (runtimeEnv.DEV ? '' : 'https://inaturamouche-api.fly.dev');

function getStorage(kind = 'local') {
  if (typeof window === 'undefined') return null;
  try {
    return kind === 'session' ? window.sessionStorage : window.localStorage;
  } catch {
    return null;
  }
}

function buildApiUrl(path) {
  const base = API_BASE_URL || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173');
  return new URL(path, base).toString();
}

function generateId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function getClientSessionId() {
  const storage = getStorage('local');
  if (!storage) return `anon-${Math.random().toString(36).slice(2, 8)}`;
  let id = storage.getItem(CLIENT_SESSION_ID_KEY);
  if (!id) {
    id = generateId();
    storage.setItem(CLIENT_SESSION_ID_KEY, id);
  }
  return id;
}

function getMetricsSessionId() {
  const storage = getStorage('session');
  if (!storage) return generateId();
  let id = storage.getItem(METRICS_SESSION_ID_KEY);
  if (!id) {
    id = generateId();
    storage.setItem(METRICS_SESSION_ID_KEY, id);
  }
  return id;
}

function sanitizeValue(value) {
  if (value == null) return null;
  if (typeof value === 'boolean' || typeof value === 'number') return value;
  return String(value).slice(0, 300);
}

function sanitizeProperties(properties = {}) {
  const sanitized = {};
  for (const [key, value] of Object.entries(properties)) {
    if (!key || key.length > 60) continue;
    sanitized[key] = sanitizeValue(value);
  }
  return sanitized;
}

export async function trackMetric(name, properties = {}, { useBeacon = false } = {}) {
  if (typeof window === 'undefined' || !name) return false;

  const payload = {
    events: [
      {
        name: String(name),
        session_id: getMetricsSessionId(),
        ts: Date.now(),
        properties: sanitizeProperties(properties),
      },
    ],
  };

  const endpoint = buildApiUrl('/api/metrics/events');
  const headers = {
    'Content-Type': 'application/json',
    'X-Client-Session-Id': getClientSessionId(),
    'X-Current-Route': window.location?.pathname || '',
  };

  if (useBeacon && typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
    const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
    return navigator.sendBeacon(endpoint, blob);
  }

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      keepalive: true,
    });
    return res.ok;
  } catch {
    return false;
  }
}

export function initClientObservability() {
  if (typeof window === 'undefined') return;
  if (window.inaturaMetricsInitialized) return;
  window.inaturaMetricsInitialized = true;

  const locale = (() => {
    const storage = getStorage('local');
    return storage?.getItem('inaturamouche_lang') || 'fr';
  })();

  void trackMetric('app_open', {
    locale,
    route: window.location?.pathname || '/',
    user_agent: navigator?.userAgent || '',
  });

  window.addEventListener('error', (event) => {
    void trackMetric(
      'client_error',
      {
        source: 'error',
        route: window.location?.pathname || '/',
        message: event?.message || 'Unhandled client error',
      },
      { useBeacon: true }
    );
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason =
      typeof event?.reason === 'string'
        ? event.reason
        : event?.reason?.message || 'Unhandled promise rejection';
    void trackMetric(
      'client_error',
      {
        source: 'unhandledrejection',
        route: window.location?.pathname || '/',
        message: reason,
      },
      { useBeacon: true }
    );
  });
}
