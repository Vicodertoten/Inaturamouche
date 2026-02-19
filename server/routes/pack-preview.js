// server/routes/pack-preview.js
// Returns preview thumbnails (4 species photos) for a given pack

import { Router } from 'express';
import { findPackById } from '../packs/index.js';
import { fetchInatJSON } from '../services/iNaturalistClient.js';

const router = Router();

// Simple in-memory cache: { [packId]: { photos: [...], fetchedAt: timestamp } }
const previewCache = new Map();
const inFlightPreviewRequests = new Map();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour for valid previews
const EMPTY_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes for empty previews
const MAX_PHOTOS = 4;
const HTTP_MAX_AGE_WITH_PHOTOS_S = 60 * 60;
const HTTP_MAX_AGE_EMPTY_S = 5 * 60;
const LIST_SAMPLE_SIZE = 10;
const LIST_CHUNK_SIZE = 6;
const DYNAMIC_PER_PAGE = 6;
const INAT_SIZE_TOKEN_RE = /(square|small|medium|large|original)(?=(?:\.[^/?#]+)?(?:[?#]|$))/i;

function setPreviewHeaders(res, photos, state) {
  const hasPhotos = Array.isArray(photos) && photos.length > 0;
  const maxAge = hasPhotos ? HTTP_MAX_AGE_WITH_PHOTOS_S : HTTP_MAX_AGE_EMPTY_S;
  res.set('Cache-Control', `public, max-age=${maxAge}, stale-while-revalidate=${maxAge * 2}`);
  res.set('X-Preview-Cache', state);
}

function shuffle(items) {
  return [...items].sort(() => Math.random() - 0.5);
}

function toPreviewSizedUrl(url, size = 'small') {
  if (!url) return '';
  if (!INAT_SIZE_TOKEN_RE.test(url)) return url;
  return url.replace(INAT_SIZE_TOKEN_RE, size);
}

function mapTaxonToPhoto(taxon) {
  const baseUrl =
    taxon?.default_photo?.small_url ||
    taxon?.default_photo?.square_url ||
    taxon?.default_photo?.medium_url ||
    taxon?.default_photo?.url ||
    '';
  if (!baseUrl) return null;
  return {
    url: toPreviewSizedUrl(baseUrl, 'small'),
    attribution: taxon?.default_photo?.attribution || '',
    name: taxon.preferred_common_name || taxon.name || '',
  };
}

function uniqueByUrl(photos) {
  const seen = new Set();
  const out = [];
  for (const photo of photos) {
    if (!photo?.url || seen.has(photo.url)) continue;
    seen.add(photo.url);
    out.push(photo);
    if (out.length >= MAX_PHOTOS) break;
  }
  return out;
}

/**
 * Fetch 4 representative photos for a pack from iNaturalist.
 */
async function fetchPackPhotos(pack, { logger, requestId } = {}) {
  if (pack.type === 'list' && Array.isArray(pack.taxa_ids) && pack.taxa_ids.length > 0) {
    // Probe a larger sample than 4 taxa to improve chance of non-empty photos.
    const sampledIds = shuffle(pack.taxa_ids).slice(0, LIST_SAMPLE_SIZE);
    const foundPhotos = [];

    for (let i = 0; i < sampledIds.length; i += LIST_CHUNK_SIZE) {
      const chunk = sampledIds.slice(i, i + LIST_CHUNK_SIZE);
      if (!chunk.length) continue;
      const data = await fetchInatJSON(
        `https://api.inaturalist.org/v1/taxa/${chunk.join(',')}`,
        {},
        { logger, requestId, label: 'pack-preview-list' }
      );
      const batchPhotos = (data?.results || [])
        .map(mapTaxonToPhoto)
        .filter(Boolean);
      foundPhotos.push(...batchPhotos);
      if (uniqueByUrl(foundPhotos).length >= MAX_PHOTOS) break;
    }

    return uniqueByUrl(foundPhotos);
  }

  if (pack.type === 'dynamic' && pack.api_params) {
    const data = await fetchInatJSON(
      'https://api.inaturalist.org/v1/observations/species_counts',
      {
        ...pack.api_params,
        per_page: DYNAMIC_PER_PAGE,
        photos: true,
        order: 'desc',
        order_by: 'observations_count',
      },
      { logger, requestId, label: 'pack-preview-dynamic' }
    );
    const photos = (data?.results || [])
      .map((item) => mapTaxonToPhoto(item?.taxon))
      .filter(Boolean);
    return uniqueByUrl(photos);
  }

  return [];
}

function cachePhotos(packId, photos) {
  const ttl = photos.length > 0 ? CACHE_TTL_MS : EMPTY_CACHE_TTL_MS;
  previewCache.set(packId, {
    photos,
    fetchedAt: Date.now(),
    expiresAt: Date.now() + ttl,
  });
}

function refreshPackPreview(packId, pack, { logger, requestId } = {}) {
  const inFlight = inFlightPreviewRequests.get(packId);
  if (inFlight) return inFlight;

  const refreshPromise = fetchPackPhotos(pack, { logger, requestId })
    .then((photos) => {
      cachePhotos(packId, photos);
      return photos;
    })
    .finally(() => {
      if (inFlightPreviewRequests.get(packId) === refreshPromise) {
        inFlightPreviewRequests.delete(packId);
      }
    });

  inFlightPreviewRequests.set(packId, refreshPromise);
  return refreshPromise;
}

router.get('/api/packs/:id/preview', async (req, res) => {
  const { id } = req.params;
  const pack = findPackById(id);

  if (!pack || pack.type === 'custom') {
    return res.json({ photos: [] });
  }

  // Check cache
  const cached = previewCache.get(id);
  if (cached && Date.now() < cached.expiresAt) {
    setPreviewHeaders(res, cached.photos, 'HIT');
    return res.json({ photos: cached.photos });
  }

  // Stale-while-refresh for non-empty previews: return immediately, refresh in background.
  if (cached?.photos?.length > 0) {
    refreshPackPreview(id, pack, { logger: req.log, requestId: req.id })
      .catch((err) => {
        req.log?.warn({ err, packId: id, requestId: req.id }, 'Pack preview background refresh failed');
      });
    setPreviewHeaders(res, cached.photos, 'STALE');
    return res.json({ photos: cached.photos });
  }

  try {
    const joiningInFlight = inFlightPreviewRequests.has(id);
    const photos = await refreshPackPreview(id, pack, { logger: req.log, requestId: req.id });
    setPreviewHeaders(res, photos, joiningInFlight ? 'JOIN' : 'MISS');
    return res.json({ photos });
  } catch (err) {
    // If we had stale data, serve it instead of failing hard.
    if (cached?.photos?.length) {
      req.log?.warn({ err, packId: id, requestId: req.id }, 'Pack preview refresh failed, serving stale cache');
      setPreviewHeaders(res, cached.photos, 'STALE');
      return res.json({ photos: cached.photos });
    }
    req.log?.warn({ err, packId: id, requestId: req.id }, 'Pack preview unavailable, returning empty preview');
    const ttl = EMPTY_CACHE_TTL_MS;
    previewCache.set(id, {
      photos: [],
      fetchedAt: Date.now(),
      expiresAt: Date.now() + ttl,
    });
    setPreviewHeaders(res, [], 'ERROR');
    return res.json({ photos: [] });
  }
});

export default router;
