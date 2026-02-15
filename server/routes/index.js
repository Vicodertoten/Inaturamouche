// server/routes/index.js
// Router principal qui combine toutes les routes

import { Router } from 'express';
import healthRouter from './health.js';
import packsRouter from './packs.js';
import packPreviewRouter from './pack-preview.js';
import quizRouter from './quiz.js';
import taxaRouter from './taxa.js';
import placesRouter from './places.js';
import reportsRouter from './reports.js';
import dailyRouter from './daily.js';

const router = Router();

// Combiner tous les routers
router.use(healthRouter);
router.use(packsRouter);
router.use(packPreviewRouter);
router.use(quizRouter);
router.use(taxaRouter);
router.use(placesRouter);
router.use(reportsRouter);
router.use(dailyRouter);

export default router;
