# Navigation rapide

## Parcours recommande (nouveau dev)

1. `README.md`
2. `wiki/GETTING_STARTED.md`
3. `wiki/ARCHITECTURE.md`
4. `wiki/API_REFERENCE.md`
5. Domaine cible:
   - backend: `wiki/guides/backend/*`
   - frontend: `wiki/guides/frontend/*`
   - ops: `wiki/guides/ops/*`

## Parcours revue de PR

1. Lire `wiki/ARCHITECTURE.md` (impact global)
2. Lire `wiki/API_REFERENCE.md` (contrats)
3. Verifier tests: unit/integration/e2e
4. Verifier docs domaine mises a jour

## Parcours incident prod

1. `wiki/guides/backend/OBSERVABILITY.md`
2. `wiki/guides/ops/DEPLOYMENT.md`
3. logs backend (`X-Request-Id`, Pino)
4. smoke test `scripts/smoke-test.sh`
