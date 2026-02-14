# Contributing

Merci de contribuer.

## Workflow rapide

1. Créer une branche (`feat/...`, `fix/...`, `docs/...`)
2. Faire un changement cible
3. Exécuter les checks
4. Ouvrir une PR avec description claire

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

Toujours garder les cles alignees.

Verifier:

```bash
npm run check:i18n
```

## API et contrats

Si tu modifies une route backend:
- mettre a jour `wiki/API_REFERENCE.md`
- maintenir le contrat d'erreur standard (`error.code/message/requestId`)
- ajouter ou adapter des tests integration

## Documentation

Source canonique: `wiki/`.

Si tu modifies architecture/API/ops, mets a jour les pages wiki correspondantes dans la meme PR.
