/**
 * CRUD for user-saved custom packs in localStorage.
 * Each saved pack has: { id, name, filters, createdAt }
 */

const STORAGE_KEY = 'inaturamouche_saved_packs_v1';
const MAX_SAVED_PACKS = 20;

function readAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(packs) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(packs));
  } catch {
    // storage full or blocked
  }
}

/**
 * Return all saved packs (newest first).
 */
export function getSavedPacks() {
  return readAll().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

/**
 * Save a new custom pack. Returns the new pack object.
 * @param {string} name
 * @param {object} filters – customFilters state
 */
export function savePack(name, filters) {
  const packs = readAll();
  const pack = {
    id: `saved_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name: (name || '').slice(0, 80) || 'Pack sans nom',
    filters: { ...filters },
    createdAt: Date.now(),
  };
  packs.unshift(pack);
  writeAll(packs.slice(0, MAX_SAVED_PACKS));
  return pack;
}

/**
 * Delete a saved pack by id.
 */
export function deleteSavedPack(id) {
  writeAll(readAll().filter((p) => p.id !== id));
}

/**
 * Get a single saved pack by id.
 */
export function getSavedPackById(id) {
  return readAll().find((p) => p.id === id) || null;
}

/**
 * Check if a pack with this name already exists.
 */
export function packNameExists(name) {
  const lower = (name || '').trim().toLowerCase();
  return readAll().some((p) => (p.name || '').trim().toLowerCase() === lower);
}
