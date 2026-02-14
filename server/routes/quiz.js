// server/routes/quiz.js
// Route de génération de questions de quiz

import { Router } from 'express';
import { z } from 'zod';
import { findPackById } from '../packs/index.js';
import { createSeededRandom, buildCacheKey } from '../../lib/quiz-utils.js';
import { explainDailyLimiter, explainLimiter, quizLimiter } from '../middleware/rateLimiter.js';
import { validate, quizSchema } from '../utils/validation.js';
import { buildMonthDayFilter, geoParams, isValidISODate, getClientIp } from '../utils/helpers.js';
import { selectionStateCache, questionQueueCache } from '../cache/selectionCache.js';
import { buildQuizQuestion, getQueueEntry, fillQuestionQueue } from '../services/questionGenerator.js';
import { getFullTaxaDetails } from '../services/iNaturalistClient.js';
import { taxonDetailsCache } from '../cache/taxonDetailsCache.js';
import { generateCustomExplanation } from '../services/aiService.js';
import {
  createRoundSession,
  submitRoundAnswer,
  getAdaptiveQuestionTuning,
  getBalanceDashboardSnapshot,
} from '../services/roundStore.js';
import { config } from '../config/index.js';
import { sendError } from '../utils/http.js';

const router = Router();
const { balanceDashboardToken, balanceDashboardRequireToken } = config;

const getAuthToken = (req) => {
  const header = req.headers.authorization || '';
  if (!header) return '';
  if (header.toLowerCase().startsWith('bearer ')) return header.slice(7).trim();
  return header.trim();
};

const isAuthorized = (req, expectedToken) => {
  if (!expectedToken) return false;
  const token = getAuthToken(req);
  return token && token === expectedToken;
};

const isConfiguredToken = (value) => typeof value === 'string' && value.trim().length > 0;

const explainSchema = z
  .object({
    correctId: z.coerce.number().int().positive(),
    wrongId: z.coerce.number().int().positive(),
    locale: z.enum(['fr', 'en', 'nl']).default('fr'),
    focusRank: z.string().trim().max(32).optional().nullable(),
  })
  .refine((data) => data.correctId !== data.wrongId, {
    message: 'correctId and wrongId must differ',
    path: ['wrongId'],
  });

const submitAnswerSchema = z.object({
  round_id: z.string().trim().min(8).max(120),
  round_signature: z.string().trim().min(32).max(256),
  round_action: z
    .enum(['answer', 'hard_guess', 'hard_hint', 'taxonomic_select', 'taxonomic_hint'])
    .optional(),
  selected_taxon_id: z.union([z.string(), z.number()]).optional(),
  step_index: z.coerce.number().int().min(0).max(30).optional(),
  submission_id: z.string().trim().min(3).max(120).optional(),
  client_session_id: z.string().trim().max(120).optional(),
}).superRefine((value, ctx) => {
  const action = value.round_action || 'answer';
  const selectedRequired = action === 'answer' || action === 'hard_guess' || action === 'taxonomic_select';
  const stepRequired = action === 'taxonomic_select' || action === 'taxonomic_hint';

  if (selectedRequired && (value.selected_taxon_id === undefined || value.selected_taxon_id === null)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['selected_taxon_id'],
      message: 'selected_taxon_id is required for this action',
    });
  }
  if (stepRequired && (value.step_index === undefined || value.step_index === null)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['step_index'],
      message: 'step_index is required for this action',
    });
  }
});

router.post('/api/quiz/explain', explainLimiter, explainDailyLimiter, validate(explainSchema), async (req, res) => {
  const { correctId, wrongId, locale, focusRank } = req.valid;
  const logger = req.log;
  const requestId = req.id;
  const taxaIds = [correctId, wrongId];
  
  try {
    const taxaDetails = await getFullTaxaDetails(taxaIds, locale, { logger, requestId }, taxonDetailsCache);

    const correctTaxon = taxaDetails.find(t => t.id === correctId);
    const wrongTaxon = taxaDetails.find(t => t.id === wrongId);

    if (!correctTaxon || !wrongTaxon) {
      logger.warn({ correctId, wrongId, found: taxaDetails.map(t=>t.id) }, 'Could not find one or both taxa for explanation.');
      return sendError(req, res, {
        status: 404,
        code: 'TAXON_NOT_FOUND',
        message: 'One or both species not found.',
      });
    }

    const explanation = await generateCustomExplanation(
      correctTaxon,
      wrongTaxon,
      locale,
      logger,
      { focusRank }
    );

    res.json({ explanation });

  } catch (err) {
    logger.error({ err, requestId }, 'Failed to generate AI explanation');
    return sendError(req, res, {
      status: 500,
      code: 'EXPLANATION_FAILED',
      message: 'Could not generate explanation.',
    });
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
      game_mode,
      client_session_id,
    } = req.valid;

    const normalizedSeed = typeof seed === 'string' ? seed.trim() : '';
    const hasSeed = normalizedSeed.length > 0;
    const rng = hasSeed ? createSeededRandom(normalizedSeed) : undefined;
    const poolRng = hasSeed ? createSeededRandom(`${normalizedSeed}|pool`) : undefined;
    const normalizedSeedSession = typeof seed_session === 'string' ? seed_session.trim() : '';

    const gameMode = game_mode || 'easy';
    const geo = hasSeed ? { p: {}, mode: 'global' } : geoParams({ place_id, nelat, nelng, swlat, swlng });
    const params = {
      quality_grade: 'research',
      photos: true,
      rank: 'species',
      per_page: 80,
      locale,
      ...geo.p,
    };
    if (!hasSeed && gameMode !== 'riddle' && (media_type === 'sounds' || media_type === 'both')) {
      params.sounds = true;
    }
    const monthDayFilter = hasSeed ? null : buildMonthDayFilter(d1, d2);

    if (pack_id) {
      const selectedPack = findPackById(pack_id);
      if (!selectedPack) {
        return sendError(req, res, {
          status: 400,
          code: 'UNKNOWN_PACK',
          message: 'Unknown pack',
        });
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
    const cacheKeyParams = { ...params, game_mode: gameMode };
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

    req.log?.debug(
      { clientSessionId: client_session_id || null, clientIp, clientKey },
      'Session persistence'
    );

    const queueKey = `${cacheKey}|${clientKey || 'anon'}`;
    const context = {
      params,
      cacheKey,
      monthDayFilter,
      locale,
      gameMode,
      geoMode: geo.mode,
      clientId: clientKey,
      adaptiveTuning: hasSeed
        ? null
        : getAdaptiveQuestionTuning({
            clientId: clientKey,
            gameMode,
          }),
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
      return sendError(req, res, {
        status: 503,
        code: 'POOL_UNAVAILABLE',
        message: 'Observation pool unavailable, please try again.',
      });
    }

    if (item?.validation) {
      const round = createRoundSession({
        clientId: clientKey,
        gameMode: item.validation.game_mode,
        correctTaxonId: item.validation.correct_taxon_id,
        correctAnswer: item.validation.correct_answer,
        inaturalistUrl: item.validation.inaturalist_url,
        maxAttempts: item.validation.max_attempts,
        locale: item.validation.locale || locale,
        hardMode: item.validation.hard_mode,
        taxonomicMode: item.validation.taxonomic_mode,
      });
      item.payload.round_id = round.round_id;
      item.payload.round_signature = round.round_signature;
      item.payload.round_expires_at = round.round_expires_at;
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
    const status = Number.parseInt(String(err?.status ?? 500), 10) || 500;
    let code = err?.code || (status === 500 ? 'INTERNAL_SERVER_ERROR' : 'ERROR');
    let message = status >= 500 ? 'Internal server error' : err?.message || 'Error';
    if (err?.code === 'timeout') {
      code = 'INAT_TIMEOUT';
      message = 'iNaturalist service is slow or unavailable, please try again.';
    }
    if (err?.code === 'circuit_open') {
      code = 'INAT_UNAVAILABLE';
      message = 'iNaturalist service is temporarily unavailable, please try again later.';
    }
    return sendError(req, res, { status, code, message });
  }
});

router.post('/api/quiz/submit', quizLimiter, validate(submitAnswerSchema), async (req, res) => {
  try {
    const {
      round_id,
      round_signature,
      round_action,
      selected_taxon_id,
      step_index,
      submission_id,
      client_session_id,
    } = req.valid;

    const clientIp = getClientIp(req);
    const clientKey = client_session_id || clientIp || 'anon';

    const result = await submitRoundAnswer({
      roundId: round_id,
      roundSignature: round_signature,
      clientId: clientKey,
      roundAction: round_action,
      selectedTaxonId: selected_taxon_id,
      stepIndex: step_index,
      submissionId: submission_id,
      logger: req.log,
      requestId: req.id,
    });

    return res.json(result);
  } catch (err) {
    req.log?.warn({ err, requestId: req.id }, 'Quiz submit failed');
    const status = Number.parseInt(String(err?.status ?? 400), 10) || 400;
    const code = err?.code || (status >= 500 ? 'INTERNAL_SERVER_ERROR' : 'BAD_REQUEST');
    const message = status >= 500 ? 'Internal server error' : err?.message || 'Error';
    return sendError(req, res, { status, code, message });
  }
});

router.get('/api/quiz/balance-dashboard', (req, res) => {
  try {
    if (balanceDashboardRequireToken) {
      if (!isConfiguredToken(balanceDashboardToken)) {
        return sendError(req, res, {
          status: 503,
          code: 'BALANCE_DASHBOARD_DISABLED',
          message: 'Balance dashboard is not configured.',
        });
      }
      if (!isAuthorized(req, balanceDashboardToken)) {
        return sendError(req, res, {
          status: 401,
          code: 'UNAUTHORIZED',
          message: 'Unauthorized',
        });
      }
    }

    const snapshot = getBalanceDashboardSnapshot();
    return res.json(snapshot);
  } catch (err) {
    req.log?.error({ err, requestId: req.id }, 'Balance dashboard failed');
    return sendError(req, res, {
      status: 500,
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Internal server error',
    });
  }
});

export default router;
