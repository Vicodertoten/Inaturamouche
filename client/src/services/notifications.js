const CHANNEL = 'inaturamouche:notify';
const DEDUPE_WINDOW_MS = 400;
const recentNotifications = new Map();

export const notify = (message, { type = 'error', duration = 4000, dedupeKey } = {}) => {
  if (!message || typeof window === 'undefined') return;
  const key = dedupeKey || `${type}:${message}`;
  const now = Date.now();
  const last = recentNotifications.get(key);
  if (last && now - last < DEDUPE_WINDOW_MS) return;
  recentNotifications.set(key, now);
  window.dispatchEvent(new CustomEvent(CHANNEL, { detail: { message, type, duration } }));
};

export const subscribeToNotifications = (handler) => {
  if (typeof window === 'undefined' || typeof handler !== 'function') return () => {};
  const listener = (event) => handler(event.detail);
  window.addEventListener(CHANNEL, listener);
  return () => window.removeEventListener(CHANNEL, listener);
};
