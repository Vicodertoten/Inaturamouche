// server/cache/selectionCache.js
// Cache pour l'état de sélection des clients

import { SmartCache } from '../../lib/smart-cache.js';
import { config } from '../config/index.js';
import { Mutex } from 'async-mutex';

const { maxSelectionStates, selectionStateTtl } = config;

export const selectionStateCache = new SmartCache({
  max: maxSelectionStates,
  ttl: selectionStateTtl,
});

export const questionQueueCache = new SmartCache({
  max: maxSelectionStates,
  ttl: selectionStateTtl,
});

/**
 * Map de mutexes pour protéger l'accès concurrence à selectionStateCache par clientId.
 * Chaque clientId (combinaison cacheKey|clientId) a son propre mutex.
 * Cela prévient les race conditions lors de la lecture/modification de l'état.
 */
const selectionStateMutexes = new Map();

/**
 * Obtenir ou créer un mutex pour une clé de sélection d'état.
 * @param {string} key - Clé unique pour le client (cacheKey|clientId)
 * @returns {Mutex}
 */
export function getOrCreateMutex(key) {
  if (!selectionStateMutexes.has(key)) {
    selectionStateMutexes.set(key, new Mutex());
  }
  return selectionStateMutexes.get(key);
}

/**
 * Nettoyer les mutexes inutilisés.
 * Appelée périodiquement pour éviter les fuites de mémoire.
 * Supprime les mutexes dont les clés ne sont plus dans le cache.
 */
export function pruneMutexes() {
  const cacheKeys = new Set(Object.keys(selectionStateCache._store || {}));
  for (const key of selectionStateMutexes.keys()) {
    if (!cacheKeys.has(key)) {
      selectionStateMutexes.delete(key);
    }
  }
}

// Nettoyer les mutexes toutes les 5 minutes
setInterval(() => {
  pruneMutexes();
}, 1000 * 60 * 5);

export default selectionStateCache;
