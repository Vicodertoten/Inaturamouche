/**
 * Encode / decode custom filter configurations for shareable pack URLs.
 * Uses the same base64-in-URL pattern as resultsShare.js and SharedCollectionPage.
 */

/**
 * Build a compact, JSON-serialisable snapshot of filters for sharing.
 * @param {string} name – human-readable name the teacher gives the pack
 * @param {object} filters – customFilters state from filterReducer
 * @returns {object|null}
 */
export function buildPackSnapshot(name, filters) {
  if (!filters) return null;
  const snapshot = { v: 1, n: (name || '').slice(0, 80) };

  // Taxa
  if (filters.taxa_enabled) {
    snapshot.te = true;
    if (filters.includedTaxa?.length) {
      snapshot.it = filters.includedTaxa.map((t) => ({ i: t.id, n: t.name }));
    }
    if (filters.excludedTaxa?.length) {
      snapshot.et = filters.excludedTaxa.map((t) => ({ i: t.id, n: t.name }));
    }
  }

  // Place / geo
  if (filters.place_enabled && filters.geo) {
    const g = filters.geo;
    if (g.mode === 'place' && g.place_id) {
      snapshot.g = { m: 'p', p: g.place_id };
      if (g.place_name) snapshot.g.pn = g.place_name;
    } else if (g.mode === 'map' && g.nelat != null) {
      snapshot.g = { m: 'm', ne: [g.nelat, g.nelng], sw: [g.swlat, g.swlng] };
    }
  }

  // Period
  if (filters.period_enabled) {
    if (filters.d1) snapshot.d1 = filters.d1;
    if (filters.d2) snapshot.d2 = filters.d2;
  }

  return snapshot;
}

/**
 * Encode a snapshot into a URL-safe base64 token.
 */
export function encodePackSnapshot(snapshot) {
  try {
    const json = JSON.stringify(snapshot);
    return btoa(unescape(encodeURIComponent(json)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  } catch {
    return null;
  }
}

/**
 * Decode a URL token back into a snapshot object.
 */
export function decodePackSnapshot(token) {
  try {
    let b64 = token.replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    const json = decodeURIComponent(escape(atob(b64)));
    const obj = JSON.parse(json);
    if (!obj || obj.v !== 1) return null;
    return obj;
  } catch {
    return null;
  }
}

/**
 * Rebuild full customFilters state from a decoded snapshot.
 */
export function snapshotToFilters(snapshot) {
  if (!snapshot) return null;

  const filters = {
    taxa_enabled: Boolean(snapshot.te),
    includedTaxa: (snapshot.it || []).map((t) => ({ id: t.i, name: t.n })),
    excludedTaxa: (snapshot.et || []).map((t) => ({ id: t.i, name: t.n })),
    place_enabled: Boolean(snapshot.g),
    geo: { mode: 'place' },
    period_enabled: Boolean(snapshot.d1 || snapshot.d2),
    d1: snapshot.d1 || '',
    d2: snapshot.d2 || '',
  };

  if (snapshot.g) {
    if (snapshot.g.m === 'p') {
      filters.geo = { mode: 'place', place_id: snapshot.g.p };
      if (snapshot.g.pn) filters.geo.place_name = snapshot.g.pn;
    } else if (snapshot.g.m === 'm' && snapshot.g.ne) {
      filters.geo = {
        mode: 'map',
        nelat: snapshot.g.ne[0],
        nelng: snapshot.g.ne[1],
        swlat: snapshot.g.sw[0],
        swlng: snapshot.g.sw[1],
      };
    }
  }

  return filters;
}

/**
 * Build the shareable URL for a pack.
 */
export function buildPackShareUrl(token) {
  if (!token) return '';
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/pack/import/${token}`;
}
