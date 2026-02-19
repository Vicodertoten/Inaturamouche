// server/routes/packs.js
// Routes pour les packs de questions

import { Router } from 'express';
import { listPublicPacks } from '../packs/index.js';
import { buildHomePackCatalog } from '../services/catalogService.js';

const router = Router();

router.get('/api/packs', (req, res) => {
  res.json(listPublicPacks());
});

function parseCsvQueryValue(value) {
  if (Array.isArray(value)) {
    return value
      .flatMap((item) => String(item || '').split(','))
      .map((item) => item.trim())
      .filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

router.get('/api/packs/home', (req, res) => {
  try {
    const region = typeof req.query.region === 'string' ? req.query.region : 'world';
    const recentPackIds = parseCsvQueryValue(req.query.recent_pack_ids);
    const sectionLimit = Number.parseInt(String(req.query.section_limit ?? ''), 10);
    const payload = buildHomePackCatalog({
      region,
      recentPackIds,
      sectionLimit: Number.isFinite(sectionLimit) ? sectionLimit : undefined,
    });
    res.json(payload);
  } catch (err) {
    req.log?.warn?.({ err, requestId: req.id }, 'Failed to build home pack catalog, using safe fallback');
    res.json(buildHomePackCatalog());
  }
});

export default router;
