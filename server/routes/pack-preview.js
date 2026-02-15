// server/routes/pack-preview.js
// Returns preview thumbnails (4 species photos) for a given pack

import { Router } from 'express';
import { findPackById } from '../packs/index.js';
import { fetchInatJSON } from '../services/iNaturalistClient.js';

const router = Router();

// Simple in-memory cache: { [packId]: { photos: [...], fetchedAt: timestamp } }
const previewCache = new Map();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour for valid previews
const EMPTY_CACHE_TTL_MS = 60 * 1000; // 1 minute for empty previews (retry quickly)
const MAX_PHOTOS = 4;
const HTTP_MAX_AGE_WITH_PHOTOS_S = 60 * 60;
const HTTP_MAX_AGE_EMPTY_S = 60;

function setPreviewHeaders(res, photos, state) {
  const hasPhotos = Array.isArray(photos) && photos.length > 0;
  const maxAge = hasPhotos ? HTTP_MAX_AGE_WITH_PHOTOS_S : HTTP_MAX_AGE_EMPTY_S;
  res.set('Cache-Control', `public, max-age=${maxAge}`);
  res.set('X-Preview-Cache', state);
}

function shuffle(items) {
  return [...items].sort(() => Math.random() - 0.5);
}

function mapTaxonToPhoto(taxon) {
  if (!taxon?.default_photo?.medium_url) return null;
  return {
    url: taxon.default_photo.medium_url,
    attribution: taxon.default_photo.attribution || '',
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
    const sampledIds = shuffle(pack.taxa_ids).slice(0, 18);
    const chunkSize = 6;
    const foundPhotos = [];

    for (let i = 0; i < sampledIds.length; i += chunkSize) {
      const chunk = sampledIds.slice(i, i + chunkSize);
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
        per_page: 12,
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

  try {
    const photos = await fetchPackPhotos(pack, { logger: req.log, requestId: req.id });
    const ttl = photos.length > 0 ? CACHE_TTL_MS : EMPTY_CACHE_TTL_MS;
    previewCache.set(id, {
      photos,
      fetchedAt: Date.now(),
      expiresAt: Date.now() + ttl,
    });

    setPreviewHeaders(res, photos, 'MISS');
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
