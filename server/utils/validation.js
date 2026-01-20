// server/utils/validation.js
// Schémas de validation Zod

import { z } from 'zod';

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
  locale: z.string().default('fr'),
  media_type: z.enum(['images', 'sounds', 'both']).optional(),
  game_mode: z.enum(['easy', 'hard', 'riddle', 'taxonomic']).optional(),
  client_session_id: z.string().optional(),
});

export const autocompleteSchema = z.object({
  q: z.string().min(2),
  rank: z.string().optional(),
  locale: z.string().default('fr'),
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
});

export const placesSchema = z.object({
  q: z.string().trim().min(2).max(80),
  per_page: z.coerce.number().min(1).max(25).default(15),
});

const csvIds = (maxItems) =>
  z
    .string()
    .min(1)
    .max(500)
    .transform((value) =>
      String(value)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    )
    .refine((list) => list.length > 0 && list.length <= maxItems, {
      message: `Entre 1 et ${maxItems} identifiants sont requis`,
    });

export const placesByIdSchema = z.object({
  ids: csvIds(25),
});

export const taxaBatchSchema = z.object({
  ids: csvIds(100),
  locale: z.string().default('fr'),
});

// Middleware de validation pour Express
export function validate(schema) {
  return (req, res, next) => {
    const parsed = schema.safeParse({ ...req.query, ...req.body });
    if (!parsed.success)
      return res
        .status(400)
        .json({ error: { code: 'BAD_REQUEST', message: 'Bad request' }, issues: parsed.error.issues });
    req.valid = parsed.data;
    next();
  };
}
