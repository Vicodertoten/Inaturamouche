# API Reference

Base URL locale: `http://localhost:3001`

## Regles globales

- Erreurs standardisees:

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

- `X-Request-Id` est expose pour correlation logs.
- Rate limiting actif sur `/api/*` + limites specifiques par endpoint.
- Auth token: header `Authorization: Bearer <token>` (ou token brut).

Locales supportees: `fr`, `en`, `nl`.

## Endpoints

### Health

- `GET /healthz` -> `{ "ok": true }`

### Packs

- `GET /api/packs` -> catalogue des packs publics.
- `GET /api/packs/:id/preview` -> apercu de 4 photos pour un pack.

### Quiz

- `GET /api/quiz-question`
  - Query:
    - `pack_id?: string`
    - `taxon_ids?: string | string[]`
    - `include_taxa?: string | string[]`
    - `exclude_taxa?: string | string[]`
    - `place_id?: string | string[]`
    - `nelat, nelng, swlat, swlng?: number` (bbox)
    - `d1, d2?: string` (ISO date)
    - `seed?: string`
    - `seed_session?: string`
    - `question_index?: number (0..50)`
    - `locale?: fr|en|nl` (defaut `fr`)
    - `media_type?: images|sounds|both`
    - `game_mode?: easy|hard|riddle|taxonomic`
    - `client_session_id?: string`
  - Reponse: question + meta media + `round_id` + `round_signature`.

- `POST /api/quiz/submit`
  - Body:
    - `round_id` (min 8)
    - `round_signature` (min 32)
    - `round_action?: answer|hard_guess|taxonomic_select|taxonomic_hint`
    - `selected_taxon_id?: string|number` (requis pour answer, hard_guess, taxonomic_select)
    - `step_index?: number` (requis pour taxonomic_select, taxonomic_hint)
    - `submission_id?: string`
    - `client_session_id?: string`
    - `seed_session?: string`
  - Reponse: statut de manche et details utiles (correct, liens, etat hard/taxonomic).

- `POST /api/quiz/explain`
  - Body: `correctId`, `wrongId`, `locale`, `focusRank`
  - Reponse: explication + discriminant + sources (si dispo).
  - Note: fallback automatique vers locale `en` si besoin.

- `GET /api/quiz/balance-dashboard`
  - Token optionnel selon env (`BALANCE_DASHBOARD_TOKEN`).
  - Reponse: snapshot de metriques de balancing.

### Daily challenge

- `POST /api/daily/score`
  - Body: `pseudo` (1..30), `score` (0..100), `total` (1..100)
  - Reponse: `{ ok, rank, totalPlayers }`

- `GET /api/daily/leaderboard`
  - Reponse: `{ seed, entries, totalPlayers }`

### Taxa

- `GET /api/taxa/autocomplete`
  - Query: `q` (min 2), `rank`, `locale`, `name_format` (vernacular|scientific)

- `GET /api/taxon/:id`
  - Query: `locale`

- `GET /api/taxa`
  - Query: `ids` (csv, 1..100), `locale`

- `GET /api/observations/species_counts`
  - Query: `taxon_ids`, `include_taxa`, `exclude_taxa`, `place_id`, `nelat`, `nelng`, `swlat`, `swlng`, `d1`, `d2`, `locale`, `per_page` (1..200), `page` (1..500)
  - Note: au moins un filtre requis (taxon, place_id ou bbox).

### Places

- `GET /api/places`
  - Query: `q` (min 2, max 80), `per_page` (1..25)

- `GET /api/places/by-id`
  - Query: `ids` (csv, 0..25)

### Reports

- `POST /api/reports`
  - Body: `description` (min 5, max 2000), `url`, `userAgent`, `website` (honeypot)
  - Token requis si `REPORTS_REQUIRE_WRITE_TOKEN=true`.

- `GET /api/reports`
  - Token requis (`REPORTS_READ_TOKEN`).
