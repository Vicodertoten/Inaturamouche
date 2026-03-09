# Contribuer a iNaturaQuizz

Merci de contribuer. Cette page decrit le flux minimum attendu pour garder le code et la doc coherents.

## Workflow

1. Creer une branche (`feat/...`, `fix/...`, `docs/...`)
2. Faire un changement cible et teste
3. Mettre a jour la doc si besoin
4. Ouvrir une PR claire (contexte, impact, tests)

## Checks avant PR

```bash
npm --prefix client run lint
npm run lint:server
npm run check:i18n
npm run test:unit
npm run test:integration
npm --prefix client run test -- --run
```

Optionnel local E2E:

```bash
npm --prefix client run test:e2e
```

## i18n

Locales supportees:
- `client/src/locales/fr.js`
- `client/src/locales/en.js`
- `client/src/locales/nl.js`

Garder les cles alignees. Verifier avec:

```bash
npm run check:i18n
```

## API et contrats

Si une route backend change:
- Mettre a jour `wiki/API_REFERENCE.md`
- Garder le contrat d erreur (`error.code`, `error.message`, `error.requestId`)
- Ajouter ou adapter des tests integration

## Documentation

Source canonique: `wiki/`.

Toute modification d architecture, d API ou d ops doit etre accompagnee d une mise a jour de la doc correspondante.

## Systeme IA

Si le systeme IA (`server/services/ai/`) est modifie:
- Tester avec le script d'audit: `node scripts/audit-ai-explanations.mjs`
- Verifier les metriques AI (taux de fallback, qualite, latence)
- Mettre a jour `wiki/ARCHITECTURE.md` si changement d'architecture
- S'assurer que les fallbacks generiques restent coherents

Architecture actuelle: RAG → Generate (JSON structure) → Validate → Fallback
