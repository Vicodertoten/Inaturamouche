// server/routes/packs.js
// Routes pour les packs de questions

import { Router } from 'express';
import { listPublicPacks } from '../packs/index.js';

const router = Router();

router.get('/api/packs', (req, res) => {
  res.json(listPublicPacks());
});

export default router;
