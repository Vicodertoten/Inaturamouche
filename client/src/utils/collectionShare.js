/**
 * collectionShare.js — Encode/decode a collection snapshot
 * into a compact URL-safe token for the shareable collection page.
 *
 * We use deflate compression (via CompressionStream if available)
 * with a JSON payload, falling back to a truncated version if too large.
 */

/**
 * Build a collection snapshot from profile data.
 *
 * @param {Object} profile - UserContext profile
 * @returns {Object} Compact snapshot
 */
export function buildCollectionSnapshot(profile) {
  const mastery = profile?.stats?.speciesMastery ?? {};
  const species = Object.entries(mastery)
    .filter(([, v]) => v.correct > 0)
    .map(([id, v]) => [Number(id), v.correct, v.encounters || v.correct])
    .sort((a, b) => b[1] - a[1]); // sort by correct desc

  return {
    n: profile?.name || profile?.username || 'Naturaliste',
    l: getLevelFromXpSimple(profile?.xp || 0),
    x: profile?.xp || 0,
    s: species.slice(0, 100), // cap at 100 for URL size
    g: profile?.stats?.gamesPlayed || 0,
  };
}

function getLevelFromXpSimple(xp) {
  const safe = Number.isFinite(xp) && xp >= 0 ? xp : 0;
  return 1 + Math.floor(Math.sqrt(safe) / 10);
}

/**
 * Encode snapshot to URL-safe base64 string.
 */
export function encodeCollectionSnapshot(snapshot) {
  try {
    const json = JSON.stringify(snapshot);
    const b64 = btoa(unescape(encodeURIComponent(json)));
    return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  } catch {
    return null;
  }
}

/**
 * Decode a collection token back to a snapshot.
 */
export function decodeCollectionSnapshot(token) {
  try {
    let b64 = token.replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    const json = decodeURIComponent(escape(atob(b64)));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/**
 * Build a shareable collection URL.
 */
export function buildCollectionUrl(token) {
  return `${window.location.origin}/collection/share/${token}`;
}
