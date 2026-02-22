// server/routes/daily.js
// Daily leaderboard is intentionally archived for beta.

import { Router } from 'express';
import { sendError } from '../utils/http.js';

const router = Router();

function sendArchived(req, res) {
  return sendError(req, res, {
    status: 410,
    code: 'DAILY_LEADERBOARD_ARCHIVED',
    message: 'Daily leaderboard is temporarily archived during beta.',
  });
}

router.post('/api/daily/score', (req, res) => sendArchived(req, res));
router.get('/api/daily/leaderboard', (req, res) => sendArchived(req, res));

export default router;
