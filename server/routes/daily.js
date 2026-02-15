// server/routes/daily.js
// Daily challenge leaderboard — anonymous, in-memory, resets daily.

import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../utils/validation.js';
import { quizLimiter } from '../middleware/rateLimiter.js';

const router = Router();

// ── Zod schemas ──
const dailyScoreSchema = z.object({
  pseudo: z
    .string()
    .trim()
    .min(1, 'pseudo must be at least 1 character')
    .max(30, 'pseudo must be at most 30 characters')
    .regex(/^[^<>&"']*$/, 'pseudo contains invalid characters'),
  score: z.coerce.number().int().min(0).max(100),
  total: z.coerce.number().int().min(1).max(100),
});

// ── In-memory store (resets on server restart + auto-cleans daily) ──
let currentSeed = '';
let leaderboard = []; // [{ pseudo, score, total, ts }]

function ensureFreshDay(seed) {
  if (seed !== currentSeed) {
    currentSeed = seed;
    leaderboard = [];
  }
}

function todaySeed() {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * POST /api/daily/score
 * Body: { pseudo: string, score: number, total: number }
 */
router.post('/api/daily/score', quizLimiter, validate(dailyScoreSchema), (req, res) => {
  const seed = todaySeed();
  ensureFreshDay(seed);

  const { pseudo, score, total } = req.valid;

  // Prevent duplicate entries from same pseudo today
  const existing = leaderboard.find(
    (e) => e.pseudo.toLowerCase() === pseudo.toLowerCase()
  );
  if (existing) {
    // Update only if better score
    if (score > existing.score) {
      existing.score = score;
      existing.total = total;
      existing.ts = Date.now();
    }
  } else {
    leaderboard.push({ pseudo, score, total, ts: Date.now() });
  }

  // Keep only top 50
  leaderboard.sort((a, b) => b.score - a.score || a.ts - b.ts);
  if (leaderboard.length > 50) leaderboard.length = 50;

  // Find this player's rank
  const rank = leaderboard.findIndex(
    (e) => e.pseudo.toLowerCase() === pseudo.toLowerCase()
  ) + 1;

  return res.json({ ok: true, rank, totalPlayers: leaderboard.length });
});

/**
 * GET /api/daily/leaderboard
 * Returns today's leaderboard (top 20).
 */
router.get('/api/daily/leaderboard', quizLimiter, (_req, res) => {
  const seed = todaySeed();
  ensureFreshDay(seed);

  const top = leaderboard.slice(0, 20).map((e, i) => ({
    rank: i + 1,
    pseudo: e.pseudo,
    score: e.score,
    total: e.total,
  }));

  return res.json({ seed, entries: top, totalPlayers: leaderboard.length });
});

export default router;
