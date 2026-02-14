# Tests integration API

Ce dossier couvre les routes backend avec un serveur HTTP ephemere.

## Fichiers principaux

- `health.test.mjs`
- `packs.test.mjs`
- `places.test.mjs`
- `taxa.test.mjs`
- `quiz.test.mjs`
- `quiz-explain.test.mjs`
- `reports.test.mjs`

## Commandes

```bash
npm run test:integration
npm run test:unit
npm run test:all
```

## Notes

- Les appels externes (iNaturalist/Gemini) sont mockes dans les tests.
- En environnement sans permission socket, certains tests peuvent etre skips.
- Les assertions couvrent le contrat d'erreur standard et les rate limits critiques.
