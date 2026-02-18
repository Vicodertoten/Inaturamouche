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
- `server/services/*`: logique metier (generation question, store de manches, iNaturalist, IA)
- `server/cache/*`: caches memoire (SmartCache)
- `server/utils/*`: validation Zod + helpers + contrat HTTP

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
- `/profile`
- `/about`
- `/legal`

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
