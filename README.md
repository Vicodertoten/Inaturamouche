# iNaturaQuizz

Quiz naturaliste (React + Express) base sur des observations iNaturalist, avec modes `easy`, `hard`, `riddle` et `taxonomic`.

## Etat actuel (fevrier 2026)

- Backend modulaire dans `server/` (Express 5, Zod, Pino, rate limits)
- Frontend dans `client/` (React 19 + Vite + PWA)
- Contrat d'erreur API unifie: `error.code`, `error.message`, `error.requestId`
- Validation serveur des manches via signature HMAC (`round_id`, `round_signature`)
- CI: lint client + lint server + i18n check + unit + integration + build + smoke E2E Playwright

## Stack

- Frontend: React 19, Vite, React Router, Vitest, Playwright
- Backend: Node.js ESM, Express 5, Zod, Pino, Helmet, CORS
- Data externe: iNaturalist API (+ Gemini pour explications/enigmes si active)

## Lancer en local

Prerequis:
- Node.js 20+
- npm 10+

Installation:

```bash
npm ci
npm --prefix client ci
cp .env.example .env
```

Dev (2 terminaux):

```bash
# Terminal 1
npm run dev

# Terminal 2
npm --prefix client run dev
```

- API: `http://localhost:3001`
- Front: `http://localhost:5173`

## Scripts importants

Racine:

```bash
npm run lint:server
npm run test:unit
npm run test:integration
npm run ci
npm run reports
npm run smoke:test -- https://your-app-url
```

Client:

```bash
npm --prefix client run lint
npm --prefix client run test -- --run
npm --prefix client run test:e2e
npm --prefix client run build
```

## API principale

- `GET /healthz`
- `GET /api/packs`
- `GET /api/quiz-question`
- `POST /api/quiz/submit`
- `POST /api/quiz/explain`
- `GET /api/quiz/balance-dashboard`
- `POST /api/reports`, `GET /api/reports`
- `GET /api/taxa/autocomplete`, `GET /api/taxon/:id`, `GET /api/taxa`
- `GET /api/places`, `GET /api/places/by-id`
- `GET /api/observations/species_counts`

Reference complete: `wiki/API_REFERENCE.md`.

## Documentation

Source canonique: `wiki/`

- `wiki/INDEX.md`
- `wiki/GETTING_STARTED.md`
- `wiki/ARCHITECTURE.md`
- `wiki/API_REFERENCE.md`
- `wiki/guides/backend/*`
- `wiki/guides/frontend/*`
- `wiki/guides/ops/*`

Le dossier `docs/` contient des notes techniques/archives et des pointeurs vers `wiki/`.
