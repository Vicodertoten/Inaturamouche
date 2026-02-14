# API Reference

Base URL locale: `http://localhost:3001`

## Regles globales

- Format erreurs:

```json
{
  "error": {
    "code": "BAD_REQUEST",
    "message": "Bad request",
    "requestId": "...",
    "issues": []
  }
}
```

- `requestId` est toujours present dans les erreurs API.
- Header `X-Request-Id` est expose pour correlation logs.
- Rate limiting actif sur `/api/*` + limites specifiques par endpoint.

## Endpoints

### GET `/healthz`

Response `200`:

```json
{ "ok": true }
```

### GET `/api/packs`

Catalogue des packs publics.

Response `200` (extrait):

```json
[
  { "id": "custom", "type": "custom", "titleKey": "...", "descriptionKey": "..." },
  { "id": "european_mushrooms", "type": "list", "taxa_ids": [47126] },
  { "id": "world_birds", "type": "dynamic", "api_params": { "taxon_id": "3", "popular": "true" } }
]
```

### GET `/api/quiz-question`

Genere une question et initialise une manche signee.

Query params (Zod `quizSchema`):
- `pack_id?: string`
- `taxon_ids?: string|array`
- `include_taxa?: string|array`
- `exclude_taxa?: string|array`
- `place_id?: string|array`
- `nelat? nelng? swlat? swlng?: number`
- `d1? d2?: string` (ISO date)
- `seed?: string`
- `seed_session?: string`
- `locale?: string` (defaut `fr`)
- `media_type?: images|sounds|both`
- `game_mode?: easy|hard|riddle|taxonomic`
- `client_session_id?: string`

Response `200` (forme generale):

```json
{
  "image_urls": ["https://..."],
  "image_meta": [{ "id": 1, "attribution": "...", "license_code": "..." }],
  "sounds": [],
  "game_mode": "easy",
  "riddle": null,
  "choices": [{ "taxon_id": "123", "label": "..." }],
  "choice_taxa_details": [{ "taxon_id": "123", "name": "...", "preferred_common_name": "..." }],
  "taxonomic_ascension": null,
  "hard_mode": null,
  "choix_mode_facile": ["..."],
  "choix_mode_facile_ids": ["123"],
  "inaturalist_url": "https://www.inaturalist.org/observations/...",
  "round_id": "uuid",
  "round_signature": "hex-hmac",
  "round_expires_at": 1739310000000
}
```

Notes:
- La bonne reponse n'est pas exposee dans cette reponse.
- En `taxonomic`, `taxonomic_ascension.steps[*]` ne contient pas `correct_taxon_id` cote client.

Erreurs frequentes:
- `400 UNKNOWN_PACK`
- `400 BAD_REQUEST`
- `404` (pool trop faible dans certains cas)
- `429 QUIZ_RATE_LIMIT_EXCEEDED`
- `503 POOL_UNAVAILABLE`
- `500 INTERNAL_SERVER_ERROR`

Headers utiles:
- `X-Cache-Key`
- `X-Lure-Buckets`
- `X-Pool-Pages`
- `X-Pool-Obs`
- `X-Pool-Taxa`
- `X-Target-Selection-Mode`
- `Server-Timing`
- `X-Timing`

### POST `/api/quiz/submit`

Valide une reponse cote serveur.

Body:

```json
{
  "round_id": "uuid",
  "round_signature": "hex",
  "round_action": "answer",
  "selected_taxon_id": "123",
  "step_index": 0,
  "submission_id": "optional-id",
  "client_session_id": "optional-session"
}
```

`round_action`:
- `answer` (easy/riddle)
- `hard_guess`, `hard_hint`
- `taxonomic_select`, `taxonomic_hint`

Response `200` (forme):

```json
{
  "status": "win",
  "is_correct": true,
  "correct_taxon_id": "123",
  "correct_answer": { "id": "123", "name": "..." },
  "inaturalist_url": "https://...",
  "attempts_used": 0,
  "attempts_remaining": 0,
  "round_consumed": true,
  "hard_state": {},
  "taxonomic_state": {},
  "selected_taxon": {},
  "guess_outcome": "progress"
}
```

Notes:
- Tant que `round_consumed=false` et `is_correct=false`, `correct_taxon_id`/`correct_answer` restent `null`.
- Resultat dedupe si `submission_id` identique.

Erreurs frequentes:
- `400 BAD_REQUEST`
- `403 INVALID_ROUND_SIGNATURE`
- `409 HARD_HINT_LIMIT`
- `409 STEP_OUT_OF_SYNC`
- `409 TAXONOMIC_HINT_LIMIT`
- `410 ROUND_EXPIRED`

### POST `/api/quiz/explain`

Demande une explication IA sur une confusion d'especes.

Body:

```json
{
  "correctId": 101,
  "wrongId": 202,
  "locale": "fr",
  "focusRank": "family"
}
```

Response `200`:

```json
{ "explanation": "..." }
```

Erreurs:
- `400 BAD_REQUEST`
- `404 TAXON_NOT_FOUND`
- `429 EXPLAIN_RATE_LIMIT_EXCEEDED`
- `429 EXPLAIN_DAILY_QUOTA_EXCEEDED`
- `500 EXPLANATION_FAILED`

### GET `/api/quiz/balance-dashboard`

Snapshot des metriques de balancing.

Peut etre protege par token selon env.

Response `200` (extrait):

```json
{
  "generated_at": "2026-02-11T22:00:00.000Z",
  "events_window": 120,
  "total_rounds": 120,
  "global_accuracy": 0.62,
  "by_mode": {
    "easy": { "rounds": 40, "win_rate": 0.7, "avg_hints": 0.02 }
  },
  "status_distribution": { "win": 70, "lose": 40, "retry": 10 },
  "iconic_distribution": { "1": 34 }
}
```

Erreurs:
- `401 UNAUTHORIZED`
- `503 BALANCE_DASHBOARD_DISABLED`

### POST `/api/reports`

Collecte signalement utilisateur.

Body:

```json
{
  "description": "...",
  "url": "https://...",
  "userAgent": "...",
  "website": ""
}
```

Response:
- `200` success avec `reportId`
- `202` si honeypot `website` rempli (accepte sans stocker)

Erreurs:
- `400 BAD_REQUEST`
- `401 UNAUTHORIZED` (si token ecriture requis)
- `429 REPORT_RATE_LIMIT_EXCEEDED`
- `503 REPORTS_DISABLED`

### GET `/api/reports`

Lecture des signalements (token lecture requis).

Response `200`:

```json
{
  "reports": [{ "id": "...", "description": "...", "sourceIp": "...", "timestamp": "..." }],
  "total": 1
}
```

### GET `/api/taxa/autocomplete`

Query:
- `q: string (min 2)`
- `rank?: string`
- `locale?: string (defaut fr)`

Response `200`:

```json
[{ "id": 123, "name": "...", "rank": "species", "ancestor_ids": [1, 2] }]
```

### GET `/api/taxon/:id`

Query optionnelle: `locale`.

Response `200`: taxon iNaturalist detail.

Erreurs:
- `400 BAD_REQUEST`
- `404 TAXON_NOT_FOUND`

### GET `/api/taxa`

Query:
- `ids: csv (1..100)`
- `locale?: string`

Response `200`: tableau de taxons detailles.

### GET `/api/places`

Query:
- `q: string (2..80)`
- `per_page?: 1..25`

Response `200`:

```json
[{ "id": 6753, "name": "France", "type": "Country", "admin_level": 0, "area_km2": 551695 }]
```

### GET `/api/places/by-id`

Query:
- `ids: csv (0..25)`

Response `200`: meme forme que `/api/places`.

### GET `/api/observations/species_counts`

Query principale:
- taxons: `taxon_ids|include_taxa|exclude_taxa`
- geo: `place_id` ou bbox `nelat/nelng/swlat/swlng`
- `d1`, `d2`, `locale`, `per_page`, `page`

Response `200`: payload iNaturalist proxifie.

## Exemple cURL minimal

```bash
curl -s "http://localhost:3001/api/quiz-question?game_mode=easy&locale=fr" | jq

curl -s -X POST "http://localhost:3001/api/quiz/submit" \
  -H "content-type: application/json" \
  -d '{"round_id":"...","round_signature":"...","selected_taxon_id":"123"}' | jq
```
