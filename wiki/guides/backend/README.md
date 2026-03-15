# Guide backend

## Role

Le backend expose l API quiz et fait l orchestration des requetes iNaturalist (avec cache et rate limits).

## Fichiers cles

- `server/index.js`: demarrage + warmup des pools
- `server/app.js`: middleware globaux, cache headers, routes
- `server/routes/*`: endpoints HTTP
- `server/services/*`: logique metier
  - `aiService.js`: re-export bridge vers `ai/` (l'orchestration est dans `aiPipeline.js`)
  - `ai/*`: modules IA (config, pipeline, RAG, prompt builder, output filter)
  - `catalogService.js`: construction du catalogue de packs pour la home
  - `metricsStore.js`: collecte et analyse de metriques first-party
  - `questionGenerator.js`, `lureBuilder.js`, `observationPool.js`: generation quiz
  - `roundStore.js`: validation des manches cote serveur
  - `iNaturalistClient.js`: client API iNaturalist
  - `taxonomicAscension.js`: mode taxonomique (archive — HTTP 410, code conserve)
  - `reportsStore.js`: gestion des rapports de bugs
- `server/cache/*`: caches memoire (SmartCache)
- `server/utils/*`: validation Zod, helpers, contrat HTTP
- `server/packs/*`: definitions des 44 packs V3
- `packs-v3-spec.md`: spec freeze du catalogue V3 (44 packs)
- `packs-v3-conventions.md`: conventions communes backend/frontend/QA

## Flux quiz

1. `GET /api/quiz-question` genere une manche signee.
2. Le client repond via `POST /api/quiz/submit`.
3. Le backend valide la signature HMAC et renvoie le resultat.

La signature HMAC est basee sur `ROUND_HMAC_SECRET`.

## Systeme IA

Architecture RAG → Generate → Validate → Fallback:

- **Model**: Gemini 2.5 Flash avec JSON structure (`responseMimeType: "application/json"`, `responseSchema`)
- **Modules**:
  - `aiConfig.js`: configuration modele, persona "Papy Mouche", contraintes de sortie
  - `aiPipeline.js`: orchestration complete (RAG + generation + validation + fallback)
  - `promptBuilder.js`: construction des prompts avec severite et contexte
  - `ragSources.js`: collecte de donnees depuis Wikipedia et iNaturalist
  - `outputFilter.js`: validation qualite et nettoyage des reponses
- **Features**:
  - Auto-correction via champ `internal_critique` dans le schema JSON
  - Fallback generiques par classe taxonomique si echec de generation
  - Support explications (differentiation especes). Le mode enigmes est archive.
  - Cache des reponses generees pour reduire les couts
- **Observabilite**: metriques AI dans metricsStore (latence, cout, taux de fallback, raisons)

## Caching

- Pools de questions, details de taxons, autocompletion.
- TTL + stale pour limiter les appels iNaturalist.
- Selection par client via `selectionStateCache` et files via `questionQueueCache`.

## Observabilite

- Logs Pino via `pino-http`
- Header `X-Request-Id` pour correlation
- Headers additionnels sur les endpoints quiz (cache key, pool stats)

## Feature flags packs

- `PACKS_V3_ENABLED=true` (defaut): expose le catalogue V3 (44 packs actifs + legacy).
- `PACKS_V3_ENABLED=false`: rollback en un toggle vers un set legacy-safe pour Home/Catalog sans casser `pack_id` sur quiz.

## Erreurs

Format unifie: `error.code`, `error.message`, `error.requestId`.

## Documentation detaillee

Pour aller plus loin :

- [API Endpoints (reference)](../../docs/reference/api-endpoints.md)
- [Configuration (reference)](../../docs/reference/configuration.md)
- [Packs & donnees (reference)](../../docs/reference/packs-data.md)
- [Pipeline de questions (explication)](../../docs/explanation/question-pipeline.md)
- [Systeme IA (explication)](../../docs/explanation/ai-system.md)
- [Strategie de cache (explication)](../../docs/explanation/caching-strategy.md)
- [Securite des rounds (explication)](../../docs/explanation/round-security.md)
- [Metriques (explication)](../../docs/explanation/metrics-system.md)
