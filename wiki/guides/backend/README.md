# Guide backend

## Role

Le backend expose l API quiz et fait l orchestration des requetes iNaturalist (avec cache et rate limits).

## Fichiers cles

- `server/index.js`: demarrage + warmup des pools
- `server/app.js`: middleware globaux, cache headers, routes
- `server/routes/*`: endpoints HTTP
- `server/services/*`: logique metier
- `server/cache/*`: caches memoire (SmartCache)
- `server/utils/*`: validation Zod, helpers, contrat HTTP

## Flux quiz

1. `GET /api/quiz-question` genere une manche signee.
2. Le client repond via `POST /api/quiz/submit`.
3. Le backend valide la signature HMAC et renvoie le resultat.

La signature HMAC est basee sur `ROUND_HMAC_SECRET`.

## Caching

- Pools de questions, details de taxons, autocompletion.
- TTL + stale pour limiter les appels iNaturalist.
- Selection par client via `selectionStateCache` et files via `questionQueueCache`.

## Observabilite

- Logs Pino via `pino-http`
- Header `X-Request-Id` pour correlation
- Headers additionnels sur les endpoints quiz (cache key, pool stats)

## Erreurs

Format unifie: `error.code`, `error.message`, `error.requestId`.
