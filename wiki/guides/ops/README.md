# Guide ops

## Environnements

La configuration est geree via `.env` (voir `.env.example`).

Variables sensibles:

- `ROUND_HMAC_SECRET`
- `REPORTS_WRITE_TOKEN`, `REPORTS_READ_TOKEN`
- `BALANCE_DASHBOARD_TOKEN`
- `AI_API_KEY` (si IA activee)

## Deploiement

Deux options supportees dans le repo:

- Docker via `Dockerfile`
- Fly.io via `fly.toml`

## Healthcheck

- `GET /healthz` -> `{ "ok": true }`

## Logs

- Logs HTTP via Pino
- Header `X-Request-Id` pour correlation
