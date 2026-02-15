// server/utils/validation.js
// Schémas de validation Zod

import { z } from 'zod';
import { sendError } from './http.js';

const stringOrArray = z.union([z.string(), z.array(z.string())]);

export const quizSchema = z.object({
  pack_id: z.string().optional(),
  taxon_ids: stringOrArray.optional(),
  include_taxa: stringOrArray.optional(),
  exclude_taxa: stringOrArray.optional(),
  place_id: z.union([z.string(), z.array(z.string())]).optional(),
  nelat: z.coerce.number().min(-90).max(90).optional(),
  nelng: z.coerce.number().min(-180).max(180).optional(),
  swlat: z.coerce.number().min(-90).max(90).optional(),
  swlng: z.coerce.number().min(-180).max(180).optional(),
  d1: z.string().optional(),
  d2: z.string().optional(),
  seed: z.string().optional(),
  seed_session: z.string().optional(),
  question_index: z.coerce.number().int().min(0).max(50).optional(),
  locale: z.string().default('fr'),
  media_type: z.enum(['images', 'sounds', 'both']).optional(),
  game_mode: z.enum(['easy', 'hard', 'riddle', 'taxonomic']).optional(),
  client_session_id: z.string().optional(),
});

export const autocompleteSchema = z.object({
  q: z.string().min(2),
  rank: z.string().optional(),
  locale: z.string().default('fr'),
  name_format: z.enum(['vernacular', 'scientific']).default('vernacular'),
});

export const speciesCountsSchema = z.object({
  taxon_ids: stringOrArray.optional(),
  include_taxa: stringOrArray.optional(),
  exclude_taxa: stringOrArray.optional(),
  place_id: z.string().optional(),
  nelat: z.coerce.number().min(-90).max(90).optional(),
  nelng: z.coerce.number().min(-180).max(180).optional(),
  swlat: z.coerce.number().min(-90).max(90).optional(),
  swlng: z.coerce.number().min(-180).max(180).optional(),
  d1: z.string().optional(),
  d2: z.string().optional(),
  locale: z.string().default('fr'),
  per_page: z.coerce.number().min(1).max(200).default(100),
  page: z.coerce.number().min(1).max(500).default(1),
}).refine((data) => {
  const hasTaxaFilter = Boolean(data.taxon_ids || data.include_taxa || data.exclude_taxa);
  const hasPlace = Boolean(data.place_id);
  const hasBbox = [data.nelat, data.nelng, data.swlat, data.swlng].every((v) => v != null);
  return hasTaxaFilter || hasPlace || hasBbox;
}, {
  message: 'At least one filter is required',
  path: ['taxon_ids'],
});

export const placesSchema = z.object({
  q: z.string().trim().min(2).max(80),
  per_page: z.coerce.number().min(1).max(25).default(15),
});

const csvIds = (maxItems, { allowEmpty = false } = {}) => {
  const minItems = allowEmpty ? 0 : 1;
  return z
    .string()
    .min(minItems)
    .max(500)
    .transform((value) =>
      String(value)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    )
    .refine((list) => list.length >= minItems && list.length <= maxItems, {
      message: `Entre ${minItems} et ${maxItems} identifiants sont requis`,
    });
};

export const placesByIdSchema = z.object({
  ids: csvIds(25, { allowEmpty: true }),
});

export const taxonDetailParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
  locale: z.string().default('fr'),
});

export const taxaBatchSchema = z.object({
  ids: csvIds(100),
  locale: z.string().default('fr'),
});

export const reportSchema = z.object({
  description: z.string().trim().min(5, 'description must be at least 5 characters').max(2000, 'description must be at most 2000 characters'),
  url: z.string().max(500).optional(),
  userAgent: z.string().max(500).optional(),
  website: z.string().max(200).optional(), // honeypot field
});

// Middleware de validation pour Express
export function validate(schema) {
  return (req, res, next) => {
    const parsed = schema.safeParse({ ...req.query, ...req.body });
    if (!parsed.success) {
      return sendError(req, res, {
        status: 400,
        code: 'BAD_REQUEST',
        message: 'Bad request',
        issues: parsed.error.issues,
      });
    }
    req.valid = parsed.data;
    next();
  };
}
