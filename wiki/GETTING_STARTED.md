# Demarrage rapide

Ce guide explique comment lancer le projet localement et valider les checks de base.

## Prerequis

- Node.js 20+
- npm 10+
- Git

Verifier:

```bash
node -v
npm -v
git --version
```

## Installation

```bash
git clone <repo-url>
cd iNaturaQuizz
npm ci
npm --prefix client ci
cp .env.example .env
```

## Variables d environnement

Fichier de reference: `.env.example`.

Minimum local:

```env
PORT=3001
NODE_ENV=development
CORS_ORIGINS=http://localhost:5173
ROUND_HMAC_SECRET=replace_with_random_32_chars_min
```

Variables utiles selon usage:

- IA: `AI_ENABLED`, `AI_API_KEY`, `EXPLAIN_RATE_LIMIT_PER_MINUTE`, `EXPLAIN_DAILY_QUOTA_PER_IP`
- Reports: `REPORTS_WRITE_TOKEN`, `REPORTS_READ_TOKEN`, `REPORTS_REQUIRE_WRITE_TOKEN`
- Dashboard: `BALANCE_DASHBOARD_TOKEN`, `BALANCE_DASHBOARD_REQUIRE_TOKEN`

## Lancer en local

Backend:

```bash
npm run dev
```

Frontend:

```bash
npm --prefix client run dev
```

URLs:

- Front: `http://localhost:5173`
- API: `http://localhost:3001`
- Healthcheck: `http://localhost:3001/healthz`

## Qualite et tests

```bash
# lint
npm --prefix client run lint
npm run lint:server

# tests
npm run test:unit
npm run test:integration
npm --prefix client run test -- --run
npm --prefix client run test:e2e

# pipeline CI local
npm run ci
```

Notes:
- Les tests integration demarrent un serveur HTTP local et mockent les appels externes.
- En environnement restreint, certains tests peuvent etre skips si l ouverture de socket est interdite.

## Build et run

```bash
npm --prefix client run build
npm start
```

## Smoke test

```bash
npm run smoke:test -- https://your-app-url
```

Le script verifie:
- `GET /healthz`
- `GET /api/packs`
