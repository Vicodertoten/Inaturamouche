# Architecture

## Vue d ensemble

- Frontend SPA: `client/` (React + Vite + PWA)
- Backend API: `server/` (Express 5)
- Source data: iNaturalist API
- IA optionnelle: Gemini pour explications et enigmes

Flux principal:

1. Front appelle `GET /api/quiz-question`
2. Backend construit une manche signee (`round_id`, `round_signature`)
3. Front soumet via `POST /api/quiz/submit`
4. Backend valide cote serveur et renvoie le resultat

## Backend

- `server/index.js`: demarrage et warmup
- `server/app.js`: middleware globaux (CORS, Helmet, compression, logging, rate limits)
- `server/routes/*`: endpoints API
- `server/services/*`: logique metier (generation question, store de manches, iNaturalist, IA, metriques, catalogue packs)
  - `aiService.js`: orchestration du système IA (explications et enigmes)
  - `ai/`: modules IA (config, pipeline, prompt builder, RAG, output filter)
  - `catalogService.js`: construction du catalogue de packs pour la page d'accueil
  - `metricsStore.js`: collecte et analyse des metriques first-party
  - `questionGenerator.js`, `lureBuilder.js`, `observationPool.js`: generation de questions
  - `roundStore.js`: validation des manches cote serveur
  - `iNaturalistClient.js`: client API iNaturalist avec rate limiting
  - `taxonomicAscension.js`: mode de jeu taxonomique
- `server/cache/*`: caches memoire (SmartCache)
- `server/utils/*`: validation Zod + helpers + contrat HTTP
- `server/packs/*`: definitions des packs V3

Contrats et securite:

- Erreurs standardisees: `error.code`, `error.message`, `error.requestId`
- ID requete: header `X-Request-Id` via `pino-http`
- Rate limits par endpoint sensible (`/api/*`, quiz, explain, reports)
- Signature HMAC des manches (`ROUND_HMAC_SECRET`)

## Frontend

- `client/src/App.jsx`: routes
- `client/src/context/*`: etat global (user, language, packs, game)
- `client/src/state/*`: store Zustand (XP, streak, achievements)
- `client/src/services/api.js`: client API (timeouts, retries)
- `client/vite.config.js`: build + PWA

Routes UI principales:

- `/`
- `/play`
- `/end`
- `/collection`
- `/collection/share/:token`
- `/profile`
- `/challenge/:token`
- `/about`
- `/legal`

## Systeme IA

Architecture RAG → Generate → Validate → Fallback pour explications et enigmes:

- **Model**: Gemini 2.5 Flash avec sortie JSON structuree (`responseMimeType: "application/json"`)
- **Persona**: "Papy Mouche", naturaliste bienveillant et pedagogique
- **Pipeline**:
  1. RAG: collecte de donnees via Wikipedia et iNaturalist
  2. Prompt: construction contextuelle avec severite d'erreur (HUGE/MEDIUM/CLOSE)
  3. Generation: appel API avec schema JSON strict (internal_critique, explanation, discriminant)
  4. Validation: verification de qualite (longueur, orthographe, contenu)
  5. Fallback: conseils generiques par classe taxonomique si echec
- **Observabilite**: metriques AI (latence, cout, taux de fallback, raisons d'echec)
- **Configuration**: `server/services/ai/aiConfig.js`
- **RAG Sources**: Wikipedia (summaries), iNaturalist (descriptions)

## Caching

Backend:

- pool questions, details taxons, autocompletion, etat de selection, queues de questions
- mecanisme SmartCache (TTL + stale)

Frontend (PWA):

- `/api/quiz-question` en `NetworkOnly`
- metadata API en `StaleWhileRevalidate`
- images et assets en `CacheFirst`

## Observabilite

Headers utiles:

- `X-Request-Id`
- `X-Cache-Key`
- `X-Lure-Buckets`
- `X-Pool-Pages`, `X-Pool-Obs`, `X-Pool-Taxa`
- `X-Target-Selection-Mode`
- `Server-Timing`
- `X-Timing`

Details dans `wiki/guides/backend/README.md`.
