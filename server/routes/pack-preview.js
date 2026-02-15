// server/routes/pack-preview.js
// Returns preview thumbnails (4 species photos) for a given pack

import { Router } from 'express';
import { findPackById } from '../packs/index.js';

const router = Router();

// Simple in-memory cache: { [packId]: { photos: [...], fetchedAt: timestamp } }
const previewCache = new Map();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

/**
 * Fetch 4 representative photos for a pack from iNaturalist.
 */
async function fetchPackPhotos(pack) {
  try {
    let url;

    if (pack.type === 'list' && Array.isArray(pack.taxa_ids) && pack.taxa_ids.length > 0) {
      // Pick 4 random taxa from the list
      const shuffled = [...pack.taxa_ids].sort(() => Math.random() - 0.5);
      const selected = shuffled.slice(0, 4);
      url = `https://api.inaturalist.org/v1/taxa/${selected.join(',')}?per_page=4`;

      const res = await fetch(url, {
        headers: { 'User-Agent': 'Inaturamouche/1.0 (quiz-app)' },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) return [];

      const data = await res.json();
      return (data.results || [])
        .filter((t) => t.default_photo?.medium_url)
        .slice(0, 4)
        .map((t) => ({
          url: t.default_photo.medium_url,
          attribution: t.default_photo.attribution || '',
          name: t.preferred_common_name || t.name,
        }));
    }

    if (pack.type === 'dynamic' && pack.api_params) {
      const params = new URLSearchParams({
        ...pack.api_params,
        per_page: '4',
        photos: 'true',
        order: 'desc',
        order_by: 'observations_count',
      });
      url = `https://api.inaturalist.org/v1/observations/species_counts?${params}`;

      const res = await fetch(url, {
        headers: { 'User-Agent': 'Inaturamouche/1.0 (quiz-app)' },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) return [];

      const data = await res.json();
      return (data.results || [])
        .filter((r) => r.taxon?.default_photo?.medium_url)
        .slice(0, 4)
        .map((r) => ({
          url: r.taxon.default_photo.medium_url,
          attribution: r.taxon.default_photo.attribution || '',
          name: r.taxon.preferred_common_name || r.taxon.name,
        }));
    }

    return [];
  } catch {
    return [];
  }
}

router.get('/api/packs/:id/preview', async (req, res) => {
  const { id } = req.params;
  const pack = findPackById(id);

  if (!pack || pack.type === 'custom') {
    return res.json({ photos: [] });
  }

  // Check cache
  const cached = previewCache.get(id);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
    res.set('Cache-Control', 'public, max-age=3600');
    return res.json({ photos: cached.photos });
  }

  const photos = await fetchPackPhotos(pack);

  // Store in cache even if empty (prevents hammering)
  previewCache.set(id, { photos, fetchedAt: Date.now() });

  res.set('Cache-Control', 'public, max-age=3600');
  res.json({ photos });
});

export default router;
