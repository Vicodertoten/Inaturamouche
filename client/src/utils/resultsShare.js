/**
 * resultsShare.js — Encode/decode a session results snapshot
 * into a URL-safe token for the shareable results page.
 *
 * This allows students to share quiz results with teachers via link.
 */

import { getLevelFromXp } from './scoring';

/**
 * Build a results snapshot from session data.
 *
 * @param {Object} params
 * @param {string} params.playerName - Player display name
 * @param {number} params.playerXp - Total player XP
 * @param {number} params.score - Points scored in session
 * @param {number} params.xpGained - XP gained in this session
 * @param {string} params.gameMode - 'easy' | 'hard'
 * @param {string} params.packId - Pack identifier
 * @param {string} params.packName - Pack display name
 * @param {number} params.maxQuestions - Question count
 * @param {string} params.mediaType - 'images' | 'sounds' | 'both'
 * @param {boolean} params.isReview - Was this a review session
 * @param {Array} params.speciesData - Per-round data with species
 * @param {Array} params.correctSpecies - IDs of correctly identified species
 * @returns {Object} Compact snapshot
 */
export function buildResultsSnapshot({
  playerName,
  playerXp,
  score,
  xpGained,
  gameMode,
  packId,
  packName,
  maxQuestions,
  mediaType,
  isReview,
  speciesData = [],
  correctSpecies = [],
}) {
  const totalQuestions = speciesData.length;
  const correctCount = correctSpecies.length;

  // Compact species list: [taxon_id, was_correct, common_name_truncated]
  const species = speciesData
    .slice(0, 50) // cap for URL size
    .map((entry) => {
      const taxonId = entry?.resolvedAnswer?.id || entry?.correct_taxon?.id || 0;
      const wasCorrect = entry?.wasCorrect ?? false;
      const commonName = (
        entry?.resolvedAnswer?.preferred_common_name ||
        entry?.correct_taxon?.preferred_common_name ||
        ''
      ).slice(0, 40);
      const sciName = (
        entry?.resolvedAnswer?.name ||
        entry?.correct_taxon?.name ||
        ''
      ).slice(0, 40);
      return [taxonId, wasCorrect ? 1 : 0, commonName, sciName];
    });

  return {
    v: 1, // version
    n: (playerName || 'Naturaliste').slice(0, 30),
    l: getLevelFromXp(playerXp || 0),
    s: score || 0,
    xp: xpGained || 0,
    q: totalQuestions,
    c: correctCount,
    m: gameMode || 'easy',
    p: (packId || '').slice(0, 50),
    pn: (packName || '').slice(0, 50),
    mq: maxQuestions || 0,
    mt: mediaType || 'images',
    r: isReview ? 1 : 0,
    sp: species,
    t: Date.now(), // timestamp
  };
}

/**
 * Encode snapshot to URL-safe base64 string.
 */
export function encodeResultsSnapshot(snapshot) {
  try {
    const json = JSON.stringify(snapshot);
    const b64 = btoa(unescape(encodeURIComponent(json)));
    return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  } catch {
    return null;
  }
}

/**
 * Decode a results token back to a snapshot.
 */
export function decodeResultsSnapshot(token) {
  try {
    let b64 = token.replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    const json = decodeURIComponent(escape(atob(b64)));
    const parsed = JSON.parse(json);
    if (!parsed || typeof parsed !== 'object' || !parsed.v) return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Build a shareable results URL.
 */
export function buildResultsUrl(token) {
  return `${window.location.origin}/results/share/${token}`;
}
