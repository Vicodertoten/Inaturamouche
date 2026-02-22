/**
 * challengeSeed.js — Encode / decode challenge links.
 *
 * A challenge link encodes: packId, gameMode, maxQuestions, mediaType
 * in a compact base64url token embedded in the URL path.
 *
 * The friend plays the same pack & settings — NOT the exact same questions.
 * This keeps the feature simple and 100 % reliable.
 *
 * Token format (JSON → base64url):
 *   { p: packId, m: mode, q: maxQuestions, t: mediaType, sc: score, st: total }
 */

/**
 * Encode a challenge config into a URL-safe token.
 */
export function encodeChallenge({ packId, gameMode, maxQuestions, mediaType, score, total }) {
  const payload = {
    p: packId,
    m: gameMode,
    q: maxQuestions,
    t: mediaType,
  };
  if (typeof score === 'number') payload.sc = score;
  if (typeof total === 'number') payload.st = total;
  const json = JSON.stringify(payload);
  return btoa(json).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Decode a challenge token back to a config object.
 * Returns null if invalid.
 */
export function decodeChallenge(token) {
  try {
    let b64 = token.replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    const json = atob(b64);
    const data = JSON.parse(json);
    if (!data.p) return null;
    return {
      packId: data.p,
      gameMode: data.m || 'easy',
      maxQuestions: data.q || 10,
      mediaType: data.t || 'images',
      score: typeof data.sc === 'number' ? data.sc : undefined,
      total: typeof data.st === 'number' ? data.st : undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Build a full challenge URL from current location + token.
 */
export function buildChallengeUrl(token) {
  const base = window.location.origin;
  return `${base}/challenge/${token}`;
}
