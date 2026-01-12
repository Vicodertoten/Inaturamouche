const CHANNEL = 'inaturamouche:notify';

export const notify = (message, { type = 'error', duration = 4000 } = {}) => {
  if (!message || typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(CHANNEL, { detail: { message, type, duration } }));
};

export const subscribeToNotifications = (handler) => {
  if (typeof window === 'undefined' || typeof handler !== 'function') return () => {};
  const listener = (event) => handler(event.detail);
  window.addEventListener(CHANNEL, listener);
  return () => window.removeEventListener(CHANNEL, listener);
};
