// server/routes/quiz.js
// Route de génération de questions de quiz

import { Router } from 'express';
import { z } from 'zod';
import { findPackById } from '../packs/index.js';
import { createSeededRandom, buildCacheKey } from '../../lib/quiz-utils.js';
import { quizLimiter } from '../middleware/rateLimiter.js';
import { validate, quizSchema } from '../utils/validation.js';
import { buildMonthDayFilter, geoParams, isValidISODate, getClientIp } from '../utils/helpers.js';
import { selectionStateCache, questionQueueCache } from '../cache/selectionCache.js';
import { buildQuizQuestion, getQueueEntry, fillQuestionQueue } from '../services/questionGenerator.js';
import { getFullTaxaDetails } from '../services/iNaturalistClient.js';
import { taxonDetailsCache } from '../cache/taxonDetailsCache.js';
import { generateCustomExplanation } from '../services/aiService.js';

const router = Router();

const explainSchema = z.object({
  correctId: z.coerce.number().int(),
  wrongId: z.coerce.number().int(),
  locale: z.string().trim().default('fr'),
});

router.post('/api/quiz/explain', validate(explainSchema), async (req, res) => {
  const { correctId, wrongId, locale } = req.valid;
  const { logger, id: requestId } = req;
  const taxaIds = [correctId, wrongId];
  
  try {
    const taxaDetails = await getFullTaxaDetails(taxaIds, locale, { logger, requestId }, taxonDetailsCache);

    const correctTaxon = taxaDetails.find(t => t.id === correctId);
    const wrongTaxon = taxaDetails.find(t => t.id === wrongId);

    if (!correctTaxon || !wrongTaxon) {
      logger.warn({ correctId, wrongId, found: taxaDetails.map(t=>t.id) }, 'Could not find one or both taxa for explanation.');
      return res.status(404).json({ error: { code: 'TAXON_NOT_FOUND', message: 'One or both species not found.' } });
    }

    const explanation = await generateCustomExplanation(correctTaxon, wrongTaxon, locale, logger);

    res.json({ explanation });

  } catch (err) {
    logger.error({ err, requestId }, 'Failed to generate AI explanation');
    res.status(500).json({ error: { code: 'EXPLANATION_FAILED', message: 'Could not generate explanation.' } });
  }
});

router.get('/api/quiz-question', quizLimiter, validate(quizSchema), async (req, res) => {
  try {
    const {
      pack_id,
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
      seed,
      seed_session,
      locale = 'fr',
      media_type,
      client_session_id,
    } = req.valid;

    const normalizedSeed = typeof seed === 'string' ? seed.trim() : '';
    const hasSeed = normalizedSeed.length > 0;
    const rng = hasSeed ? createSeededRandom(normalizedSeed) : undefined;
    const poolRng = hasSeed ? createSeededRandom(`${normalizedSeed}|pool`) : undefined;
    const normalizedSeedSession = typeof seed_session === 'string' ? seed_session.trim() : '';

    const geo = hasSeed ? { p: {}, mode: 'global' } : geoParams({ place_id, nelat, nelng, swlat, swlng });
    const params = {
      quality_grade: 'research',
      photos: true,
      rank: 'species',
      per_page: 80,
      locale,
      ...geo.p,
    };
    if (!hasSeed && (media_type === 'sounds' || media_type === 'both')) {
      params.sounds = true;
    }
    const monthDayFilter = hasSeed ? null : buildMonthDayFilter(d1, d2);

    if (pack_id) {
      const selectedPack = findPackById(pack_id);
      if (!selectedPack) {
        return res.status(400).json({ error: { code: 'UNKNOWN_PACK', message: 'Unknown pack' } });
      }
      if (selectedPack.type === 'list' && Array.isArray(selectedPack.taxa_ids)) {
        params.taxon_id = selectedPack.taxa_ids.join(',');
      } else if (selectedPack.api_params) {
        Object.assign(params, selectedPack.api_params);
      }
    } else if (taxon_ids) {
      params.taxon_id = Array.isArray(taxon_ids) ? taxon_ids.join(',') : taxon_ids;
    } else if (include_taxa || exclude_taxa) {
      if (include_taxa) params.taxon_id = Array.isArray(include_taxa) ? include_taxa.join(',') : include_taxa;
      if (exclude_taxa)
        params.without_taxon_id = Array.isArray(exclude_taxa) ? exclude_taxa.join(',') : exclude_taxa;
    }

    if (hasSeed) {
      delete params.place_id;
      delete params.nelat;
      delete params.nelng;
      delete params.swlat;
      delete params.swlng;
    }

    if (!hasSeed) {
      if (monthDayFilter?.months?.length) {
        params.month = monthDayFilter.months.join(',');
      } else {
        if (d1 && isValidISODate(d1)) params.d1 = d1;
        if (d2 && isValidISODate(d2)) params.d2 = d2;
      }
    }
    const cacheKeyParams = { ...params };
    if (monthDayFilter) {
      cacheKeyParams.d1 = d1 || '';
      cacheKeyParams.d2 = d2 || '';
    }
    if (hasSeed) {
      cacheKeyParams.seed = normalizedSeed;
    }

    const cacheKey = buildCacheKey(cacheKeyParams);
    selectionStateCache.prune();
    questionQueueCache.prune();
    const clientIp = getClientIp(req);

    // Construire une clé client persistante : d'abord le session ID, puis IP, puis anon
    let clientKey;
    if (hasSeed && normalizedSeedSession) {
      // Jeux avec seed : incluent le seed dans la clé
      clientKey = `${client_session_id || clientIp || 'anon'}|${normalizedSeedSession}`;
    } else {
      // Jeux normaux : utiliser le session ID s'il existe, sinon l'IP
      clientKey = client_session_id || clientIp || 'anon';
    }

    // Debug logging pour session persistence
    console.log(
      `[SESSION] clientSessionId=${client_session_id || 'none'}, clientIp=${clientIp}, clientKey=${clientKey}`
    );

    const queueKey = `${cacheKey}|${clientKey || 'anon'}`;
    const context = {
      params,
      cacheKey,
      monthDayFilter,
      locale,
      geoMode: geo.mode,
      clientId: clientKey,
      logger: req.log,
      requestId: req.id,
      rng,
      poolRng,
      seed: hasSeed ? normalizedSeed : '',
    };

    const queueEntry = getQueueEntry(queueKey);
    let item = queueEntry.queue.shift();
    if (!item) {
      item = await buildQuizQuestion(context);
    }
    if (!item?.payload) {
      return res
        .status(503)
        .json({
          error: { code: 'POOL_UNAVAILABLE', message: 'Observation pool unavailable, please try again.' },
        });
    }
    if (item.headers) {
      for (const [key, value] of Object.entries(item.headers)) {
        res.set(key, value);
      }
    }
    res.json(item.payload);

    fillQuestionQueue(queueEntry, context).catch((err) => {
      req.log?.warn({ err, requestId: req.id }, 'Background queue fill failed');
    });
  } catch (err) {
    req.log?.error({ err, requestId: req.id }, 'Unhandled quiz route error');
    if (res.headersSent) return;
    const status = err?.status || 500;
    let code = err?.code || (status === 500 ? 'INTERNAL_SERVER_ERROR' : 'ERROR');
    let message = err?.message || (status === 500 ? 'Internal server error' : 'Error');
    if (err?.code === 'timeout') {
      code = 'INAT_TIMEOUT';
      message = 'iNaturalist service is slow or unavailable, please try again.';
    }
    res.status(status).json({ error: { code, message } });
  }
});

export default router;
