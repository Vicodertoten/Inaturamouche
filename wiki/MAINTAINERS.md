# Maintainers Notes

## Politique documentation

- `wiki/` = reference officielle
- `docs/` = support/legacy
- Les archives ne doivent pas etre utilisees comme spec produit

## Checklist de release

1. CI verte (`.github/workflows/ci.yml`)
2. Deploy workflow valide (`.github/workflows/deploy.yml`)
3. Smoke staging/prod OK (`scripts/smoke-test.sh`)
4. API docs alignees sur les routes dans `server/routes/*`
5. Variables d'environnement alignees sur `.env.example`

## Ownership recommande

- Backend/API: `wiki/API_REFERENCE.md` + `wiki/guides/backend/*`
- Frontend: `wiki/guides/frontend/*` + `client/README.md`
- Ops: `wiki/guides/ops/*` + workflow GitHub
