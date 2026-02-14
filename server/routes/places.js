// server/routes/places.js
// Routes pour les places (autocomplete, by-id)

import { Router } from 'express';
import { buildCacheKey } from '../../lib/quiz-utils.js';
import { fetchInatJSON } from '../services/iNaturalistClient.js';
import { autocompleteCache } from '../cache/autocompleteCache.js';
import { proxyLimiter } from '../middleware/rateLimiter.js';
import { validate, placesSchema, placesByIdSchema } from '../utils/validation.js';
import { sendError } from '../utils/http.js';

const router = Router();

// Autocomplete places
router.get('/api/places', proxyLimiter, validate(placesSchema), async (req, res) => {
  try {
    const { q, per_page } = req.valid;
    const cacheKey = buildCacheKey({ places: q, per_page });
    autocompleteCache.prune();
    const out = await autocompleteCache.getOrFetch(
      cacheKey,
      async () => {
        const data = await fetchInatJSON(
          'https://api.inaturalist.org/v1/places/autocomplete',
          { q, per_page },
          { logger: req.log, requestId: req.id, label: 'places-autocomplete' }
        );
        return (data.results || []).map((p) => ({
          id: p.id,
          name: p.display_name || p.name,
          type: p.place_type_name,
          admin_level: p.admin_level,
          area_km2: p.bounding_box_area,
        }));
      },
      {
        allowStale: true,
        background: true,
        onError: (err) => req.log?.warn({ requestId: req.id, error: err.message }, 'places cache refresh failed'),
      }
    );
    res.json(out);
  } catch (e) {
    req.log?.error({ err: e, requestId: req.id }, 'Unhandled places autocomplete error');
    return sendError(req, res, {
      status: 500,
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Internal server error',
    });
  }
});

// Get places by IDs
router.get('/api/places/by-id', proxyLimiter, validate(placesByIdSchema), async (req, res) => {
  try {
    const idsParam = req.valid.ids.join(',');
    if (!idsParam) return res.json([]);
    const data = await fetchInatJSON(
      `https://api.inaturalist.org/v1/places/${idsParam}`,
      {},
      {
        logger: req.log,
        requestId: req.id,
        label: 'places-by-id',
      }
    );
    const arr = Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];
    const out = arr.map((p) => ({
      id: p.id,
      name: p.display_name || p.name,
      type: p.place_type_name,
      admin_level: p.admin_level,
      area_km2: p.bounding_box_area,
    }));
    res.json(out);
  } catch (e) {
    req.log?.error({ err: e, requestId: req.id }, 'Unhandled places by id error');
    return sendError(req, res, {
      status: 500,
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Internal server error',
    });
  }
});

export default router;
