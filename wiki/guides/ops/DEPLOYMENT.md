# Deployment

## CI

Workflow: `.github/workflows/ci.yml`

Etapes:
1. install deps root + client
2. lint client
3. lint server
4. check i18n
5. tests unit + integration + client
6. build client
7. install Playwright Chromium
8. smoke E2E
9. `npm audit` root + client (niveau high)

## CD

Workflow: `.github/workflows/deploy.yml`

- staging deploy (hook)
- smoke test staging (`scripts/smoke-test.sh`)
- lighthouse staging gate
- production deploy (hook)
- smoke test production
- rollback manuel possible via `workflow_dispatch`

## Docker

`Dockerfile` multi-stage (Node 22):
- build client
- install deps server prod
- runtime `node server/index.js`

## Netlify

`netlify.toml`:
- build frontend dans `client/`
- proxy `/api/*` vers Render
- headers cache + securite

## Variables d'environnement

Reference unique: `.env.example`

Ne jamais commiter `.env`.
