# Architecture

## Vue d'ensemble

- Frontend SPA: `client/` (React + Vite + PWA)
- Backend API: `server/` (Express 5)
- Source data: iNaturalist API
- IA optionnelle: Gemini pour explications/enigmes

Flux principal:

1. Front appelle `GET /api/quiz-question`
2. Backend construit une manche signee (`round_id`, `round_signature`)
3. Front soumet via `POST /api/quiz/submit`
4. Backend valide cote serveur et renvoie resultat public

## Backend (structure)

- `server/index.js`: bootstrap serveur
- `server/app.js`: middleware globaux (CORS, Helmet, compression, logging, rate limits)
- `server/routes/*`: endpoints API
- `server/services/*`: logique metier (generation question, store de manches, IA, iNaturalist)
- `server/cache/*`: caches memoire (SmartCache)
- `server/utils/*`: validation Zod + helpers + contrat HTTP

### Contrats securite

- Erreurs standardisees: `error.code`, `error.message`, `error.requestId`
- ID requete: header `X-Request-Id` gere via `pino-http`
- Rate limits par endpoint sensible:
  - `/api` global
  - `/api/quiz-question` / `/api/quiz/submit`
  - `/api/quiz/explain` (minute + quota journalier)
  - `/api/reports`

### Validation de manche

- Creation d'une session de manche dans `server/services/roundStore.js`
- Signature HMAC (secret `ROUND_HMAC_SECRET`)
- Soumission dedupee via `submission_id`
- Protection contre relecture/tampering (`INVALID_ROUND_SIGNATURE`, `ROUND_EXPIRED`)

## Frontend (structure)

- `client/src/App.jsx`: routes
- `client/src/context/*`: etat global (game, user, language, xp, streak, achievements)
- `client/src/services/api.js`: client API (timeouts/retries/notifs)
- `client/vite.config.js`: config build + PWA + proxy dev

Routes UI actuelles:

- `/`
- `/play`
- `/end`
- `/collection`
- `/profile`

## Caching

Backend:
- pool questions, details taxons, autocompletion, etat de selection, queue de questions
- mecanisme SmartCache (TTL + stale)

Frontend (PWA):
- `/api/quiz-question` en `NetworkOnly`
- metadata API en `StaleWhileRevalidate`
- assets/images en `CacheFirst`

## Observabilite

Headers utilises:
- `X-Request-Id`
- `X-Cache-Key`
- `X-Lure-Buckets`
- `X-Pool-Pages`, `X-Pool-Obs`, `X-Pool-Taxa`
- `X-Target-Selection-Mode`
- `Server-Timing`
- `X-Timing`

Voir details: `wiki/guides/backend/OBSERVABILITY.md`.
