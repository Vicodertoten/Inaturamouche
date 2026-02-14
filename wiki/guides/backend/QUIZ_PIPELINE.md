# Quiz Pipeline (backend)

Pipeline principal: `GET /api/quiz-question` + `POST /api/quiz/submit`.

## 1. Validation et normalisation

- Validation query via Zod (`server/utils/validation.js`)
- Normalisation des filtres:
  - pack (`pack_id`) ou taxons (`taxon_ids/include_taxa/exclude_taxa`)
  - geo (`place_id` ou bbox)
  - dates (`d1/d2`), locale, mode de jeu

## 2. Pool d'observations

`server/services/observationPool.js`:
- compose `params` iNaturalist
- construit la `cacheKey`
- lit/refresh le pool en cache
- fournit `poolObs`, `poolTaxa`, `pagesFetched`

## 3. Etat de selection par client

`server/services/selectionState.js` + `selectionStateCache`:
- deck de taxons melange
- historique recent (anti-repetition)
- logique de cooldown

La cle client combine `client_session_id` puis IP fallback.

## 4. Generation de la question

`server/services/questionGenerator.js`:
- choisit un taxon cible eligible
- choisit une observation
- construit des leurres (`buildLures`) selon proximite
- enrichit les taxons (details iNat cache)
- prepare payload selon mode:
  - `easy`: choices + `choix_mode_facile`
  - `hard`: ajoute `hard_mode`
  - `riddle`: ajoute `riddle`
  - `taxonomic`: ajoute `taxonomic_ascension`

## 5. Signature de manche

`server/services/roundStore.js`:
- creation session de manche (`round_id`, `round_signature`, `round_expires_at`)
- signature HMAC avec `ROUND_HMAC_SECRET`

## 6. Soumission serveur-authoritative

`POST /api/quiz/submit`:
- verifie signature + expiration
- dedupe via `submission_id`
- applique l'action (`answer`, `hard_guess`, `hard_hint`, `taxonomic_select`, `taxonomic_hint`)
- renvoie un payload public (solution masquee tant que manche non consommee)

## 7. Codes d'erreur critiques

- `UNKNOWN_PACK`
- `POOL_UNAVAILABLE`
- `INVALID_ROUND_SIGNATURE`
- `ROUND_EXPIRED`
- `STEP_OUT_OF_SYNC`
- `HARD_HINT_LIMIT`
- `TAXONOMIC_HINT_LIMIT`

## 8. Tests de reference

- `tests/integration/quiz.test.mjs`
- `tests/integration/quiz-explain.test.mjs`
- `tests/server/errors.test.mjs`
