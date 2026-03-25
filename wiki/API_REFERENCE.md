# API Reference

> Resume rapide. Pour le detail complet des contrats, limites et codes d'erreur, voir [`docs/reference/api-endpoints.md`](../docs/reference/api-endpoints.md).

Base URL locale: `http://localhost:3001`

## Regles globales

- Format d'erreur unifie:

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

- Locales supportees: `fr`, `en`, `nl`
- Header de correlation: `X-Request-Id`
- Rate limiting sur `/api/*` + limites specifiques pour quiz, explain, reports
- Auth Bearer sur certains endpoints internes

## Endpoints principaux

### Health

- `GET /healthz`

### Packs

- `GET /api/packs`
- `GET /api/packs/:id/preview`
- `GET /api/packs/home`

### Quiz

- `GET /api/quiz-question`
  - `game_mode`: `easy|hard`
  - les valeurs archivees `riddle` et `taxonomic` existent encore dans certaines validations mais renvoient `410 MODE_ARCHIVED`
- `POST /api/quiz/submit`
  - `round_action`: `answer|hard_guess`
  - les actions archivees `taxonomic_select` et `taxonomic_hint` restent rejetees en `410`
- `POST /api/quiz/explain`
  - corps: `correctId`, `wrongId`, `locale`, `mode`, contexte optionnel (`packId`, `gameMode`, `masteryBucket`, `confusionBucket`, `imageContext`)
- `GET /api/quiz/balance-dashboard`
  - token requis selon environnement

### Taxa et places

- `GET /api/taxa/autocomplete`
- `GET /api/taxon/:id`
- `GET /api/taxa`
- `GET /api/observations/species_counts`
- `GET /api/places`
- `GET /api/places/by-id`

### Reports

- `POST /api/reports`
- `GET /api/reports`

### Metrics

- `POST /api/metrics/events`
- `GET /api/metrics/dashboard`

Le backend accepte actuellement 23 noms d'evenements client, definis dans `server/routes/metrics.js`.

### Daily leaderboard archive

- `POST /api/daily/score` -> `410 DAILY_LEADERBOARD_ARCHIVED`
- `GET /api/daily/leaderboard` -> `410 DAILY_LEADERBOARD_ARCHIVED`

## Documentation detaillee

- [docs/reference/api-endpoints.md](../docs/reference/api-endpoints.md)
- [docs/reference/configuration.md](../docs/reference/configuration.md)
- [wiki/guides/backend/README.md](guides/backend/README.md)
