// src/utils/logger.js
// Logger frontend: verbeux en développement, silencieux en production.

const isDev = typeof import.meta !== 'undefined' && Boolean(import.meta.env?.DEV);

export function debugLog(...args) {
  if (isDev) {
    console.log(...args);
  }
}

export function debugWarn(...args) {
  if (isDev) {
    console.warn(...args);
  }
}

export function debugError(...args) {
  if (isDev) {
    console.error(...args);
  }
}
