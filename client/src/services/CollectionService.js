/**
 * CollectionService — barrel re-export.
 *
 * Implementation is split across:
 *   collection/MasteryEngine.js     — constants, XP thresholds, level calculation
 *   collection/CollectionRepository.js — CRUD, encounter recording, pagination
 *   collection/ReviewScheduler.js   — Spaced Repetition scheduling & stats
 *
 * This file re-exports everything so existing consumers keep working unchanged.
 */

// ── Mastery constants & helpers ──
export {
  MASTERY_LEVELS,
  MASTERY_NAMES,
  XP_GAINS,
  MASTERY_XP_THRESHOLDS,
  calculateMasteryLevel,
} from './collection/MasteryEngine.js';

// ── Repository (CRUD + encounter) ──
export {
  seedTaxa,
  upsertTaxon,
  recordEncounter,
  getIconicSummary,
  getSpeciesPage,
  getSpeciesDetail,
  rebuildRarityTiers,
  updateTaxonDescription,
  onCollectionUpdated,
  getSimilarSpecies,
} from './collection/CollectionRepository.js';

// ── Spaced Repetition ──
export {
  calculateNextReviewDate,
  calculateReviewInterval,
  calculateEaseFactor,
  getSpeciesDueForReview,
  getReviewStats,
} from './collection/ReviewScheduler.js';

// ── Default export (backward compat) ──
import { MASTERY_LEVELS, MASTERY_NAMES, XP_GAINS, MASTERY_XP_THRESHOLDS } from './collection/MasteryEngine.js';
import {
  seedTaxa,
  upsertTaxon,
  recordEncounter,
  getIconicSummary,
  getSpeciesPage,
  getSpeciesDetail,
  rebuildRarityTiers,
  updateTaxonDescription,
  onCollectionUpdated,
  getSimilarSpecies,
} from './collection/CollectionRepository.js';

const CollectionService = {
  MASTERY_LEVELS,
  MASTERY_NAMES,
  XP_GAINS,
  MASTERY_XP_THRESHOLDS,
  seedTaxa,
  upsertTaxon,
  recordEncounter,
  getIconicSummary,
  getSpeciesPage,
  getSpeciesDetail,
  rebuildRarityTiers,
  updateTaxonDescription,
  getSimilarSpecies,
  onCollectionUpdated,
};

export default CollectionService;
