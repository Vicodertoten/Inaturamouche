// server/services/aiService.js
// ─── Pont de compatibilité vers le nouveau module AI v3 ───
// Ce fichier re-exporte les fonctions du nouveau pipeline AI
// pour éviter de casser les imports existants.
//
// Le nouveau système se trouve dans server/services/ai/
// Architecture : RAG → Draft → Fact-Check → Output Filter → Fallback
//
// Ancien code déplacé dans server/services/ai/ :
//   - aiConfig.js      → Model config, persona, output constraints
//   - ragSources.js    → RAG pipeline (iNat, Wikipedia, GBIF, CoL)
//   - promptBuilder.js → System/user prompt construction
//   - outputFilter.js  → Validation, normalization, fallback
//   - aiPipeline.js    → 2-stage Draft → FactCheck pipeline
//   - index.js         → Barrel export

export { generateCustomExplanation, generateRiddle } from './ai/index.js';
