# Server

API Express de Inaturamouche.

## Entree

- `server/index.js`: start serveur
- `server/app.js`: composition middleware/routes

## Routes exposees

- `GET /healthz`
- `GET /api/packs`
- `GET /api/quiz-question`
- `POST /api/quiz/submit`
- `POST /api/quiz/explain`
- `GET /api/quiz/balance-dashboard`
- `POST /api/reports`
- `GET /api/reports`
- `GET /api/taxa/autocomplete`
- `GET /api/taxon/:id`
- `GET /api/taxa`
- `GET /api/places`
- `GET /api/places/by-id`
- `GET /api/observations/species_counts`

## Points techniques

- Validation: Zod
- Logs: Pino (`X-Request-Id`)
- Erreurs: contrat unifie (`error.code/message/requestId`)
- Rate limiting: global + endpoint-specifique
- Signature HMAC des manches: `ROUND_HMAC_SECRET`

## Commandes

```bash
npm run dev
npm start
npm run lint:server
npm run test:unit
npm run test:integration
```

## Reference

- `wiki/API_REFERENCE.md`
- `wiki/guides/backend/QUIZ_PIPELINE.md`
- `wiki/guides/backend/OBSERVABILITY.md`
