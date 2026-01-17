// server/routes/health.js
// Route de health check

import { Router } from 'express';

const router = Router();

router.get('/healthz', (req, res) => res.json({ ok: true }));

export default router;
