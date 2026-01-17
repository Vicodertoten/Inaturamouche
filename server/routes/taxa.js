// server/routes/taxa.js
// Routes pour les taxons (autocomplete, detail, batch, species_counts)

import { Router } from 'express';
import { z } from 'zod';
import { buildCacheKey } from '../../lib/quiz-utils.js';
import { fetchInatJSON, getFullTaxaDetails } from '../services/iNaturalistClient.js';
import { autocompleteCache } from '../cache/autocompleteCache.js';
import taxonDetailsCache from '../cache/taxonDetailsCache.js';
import { proxyLimiter } from '../middleware/rateLimiter.js';
import { validate, autocompleteSchema, taxaBatchSchema, speciesCountsSchema } from '../utils/validation.js';
import { geoParams } from '../utils/helpers.js';

const router = Router();

// Autocomplete taxons
router.get('/api/taxa/autocomplete', validate(autocompleteSchema), async (req, res) => {
  try {
    const { q, rank, locale = 'fr' } = req.valid;
    autocompleteCache.prune();
    const cacheKey = buildCacheKey({ q: String(q).trim(), rank, locale });
    const out = await autocompleteCache.getOrFetch(
      cacheKey,
      async () => {
        const params = { q: String(q).trim(), is_active: true, per_page: 10, locale };
        if (rank) params.rank = rank;

        const response = await fetchInatJSON('https://api.inaturalist.org/v1/taxa/autocomplete', params, {
          logger: req.log,
          requestId: req.id,
          label: 'taxa-autocomplete',
        });
        const initial = Array.isArray(response.results) ? response.results : [];
        if (initial.length === 0) {
          return [];
        }

        const taxonIds = initial.map((t) => t.id);
        const taxaDetails = await getFullTaxaDetails(taxonIds, locale, { logger: req.log, requestId: req.id }, taxonDetailsCache);
        const byId = new Map(taxaDetails.map((t) => [t.id, t]));

        return initial.map((t) => {
          const d = byId.get(t.id);
          return {
            id: t.id,
            name: t.preferred_common_name ? `${t.preferred_common_name} (${t.name})` : t.name,
            rank: t.rank,
            ancestor_ids: Array.isArray(d?.ancestors) ? d.ancestors.map((a) => a.id) : [],
          };
        });
      },
      {
        allowStale: true,
        background: true,
        onError: (err) => req.log?.warn({ requestId: req.id, error: err.message }, 'taxa autocomplete refresh failed'),
      }
    );
    res.json(out);
  } catch (err) {
    req.log?.error({ err, requestId: req.id }, 'Unhandled autocomplete error');
    res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Internal server error' } });
  }
});

// Détail d'un taxon
router.get('/api/taxon/:id', proxyLimiter, async (req, res) => {
  try {
    const parsed = z
      .object({
        id: z.coerce.number().int().positive(),
        locale: z.string().default('fr'),
      })
      .safeParse({ id: req.params.id, locale: req.query.locale });
    if (!parsed.success) {
      return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Bad request' }, issues: parsed.error.issues });
    }
    const { id, locale } = parsed.data;
    const response = await fetchInatJSON(
      `https://api.inaturalist.org/v1/taxa/${id}`,
      { locale },
      { logger: req.log, requestId: req.id, label: 'taxon-detail' }
    );
    const result = Array.isArray(response.results) ? response.results[0] : undefined;
    if (!result) return res.status(404).json({ error: { code: 'TAXON_NOT_FOUND', message: 'Taxon not found.' } });
    res.json(result);
  } catch (err) {
    req.log?.error({ err, requestId: req.id }, 'Unhandled taxon error');
    res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Internal server error' } });
  }
});

// Batch de taxons
router.get('/api/taxa', proxyLimiter, validate(taxaBatchSchema), async (req, res) => {
  try {
    const { ids, locale } = req.valid;
    const taxaDetails = await getFullTaxaDetails(ids, locale, { logger: req.log, requestId: req.id }, taxonDetailsCache);
    res.json(taxaDetails);
  } catch (err) {
    req.log?.error({ err, requestId: req.id }, 'Unhandled taxa error');
    res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Internal server error' } });
  }
});

// Species counts
router.get('/api/observations/species_counts', proxyLimiter, validate(speciesCountsSchema), async (req, res) => {
  try {
    const {
      taxon_ids,
      include_taxa,
      exclude_taxa,
      place_id,
      nelat,
      nelng,
      swlat,
      swlng,
      d1,
      d2,
      locale,
      per_page,
      page,
    } = req.valid;

    const geo = geoParams({ place_id, nelat, nelng, swlat, swlng });
    const params = {
      locale,
      per_page,
      page,
      verifiable: true,
      quality_grade: 'research',
      ...geo.p,
    };

    if (taxon_ids) params.taxon_id = Array.isArray(taxon_ids) ? taxon_ids.join(',') : taxon_ids;
    if (include_taxa) params.taxon_id = Array.isArray(include_taxa) ? include_taxa.join(',') : include_taxa;
    if (exclude_taxa) params.without_taxon_id = Array.isArray(exclude_taxa) ? exclude_taxa.join(',') : exclude_taxa;
    if (d1) params.d1 = d1;
    if (d2) params.d2 = d2;

    const data = await fetchInatJSON('https://api.inaturalist.org/v1/observations/species_counts', params, {
      logger: req.log,
      requestId: req.id,
      label: 'species-counts',
    });
    res.json(data);
  } catch (err) {
    req.log?.error({ err, requestId: req.id }, 'Unhandled species_counts error');
    res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Internal server error' } });
  }
});

export default router;
