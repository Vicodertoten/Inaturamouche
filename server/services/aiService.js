// server/services/aiService.js
// Bridge de compatibilité vers le module IA actuel.
// Les anciens imports `aiService.js` pointent maintenant vers `server/services/ai/`.
//
// Architecture réelle :
// RAG evidence bundle -> Gemini JSON generation -> validation/support gating
// -> optional repair pass -> deterministic fallback.
//
// Modules :
//   - aiConfig.js      -> model config, cache policies, security constants
//   - ragSources.js    -> collecte RAG (Wikipedia, iNaturalist, GBIF, CoL)
//   - promptBuilder.js -> prompts brief/full/repair/riddle
//   - outputFilter.js  -> validation, attribution, fallback morphology
//   - aiPipeline.js    -> orchestration complete
//   - index.js         -> barrel export

export { generateCustomExplanation, generateRiddle } from './ai/index.js';
