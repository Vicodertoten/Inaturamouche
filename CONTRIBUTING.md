# Contribuer a iNaturaQuizz

Merci de contribuer. Cette page decrit le flux minimum attendu pour garder le code et la doc coherents.

## Workflow

1. Creer une branche (`feat/...`, `fix/...`, `docs/...`)
2. Faire un changement cible et teste
3. Mettre a jour la doc si besoin
4. Ouvrir une PR claire (contexte, impact, tests)

## Checks avant PR

```bash
npm run docs:check
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

Source canonique : `wiki/` + `docs/`.

Structure de la documentation :

```
README.md                 ← Vue produit + quickstart
wiki/INDEX.md             ← Point d'entree canonique
wiki/ARCHITECTURE.md      ← Vue d'ensemble rapide
wiki/API_REFERENCE.md     ← Reference API courte
wiki/guides/              ← Guides backend / frontend / ops
docs/reference/           ← Contrats, formats, valeurs exactes
docs/explanation/         ← Architecture, flux, raisonnement
docs/archive/             ← Notes internes et historiques non canoniques
```

Regles :

- Toute modification d'architecture, d'API, d'ops, de pipeline IA, de packs ou d'etat frontend doit etre documentee dans la couche canonique appropriee.
- Les notes de reunion, audits internes et documents historiques vont dans `docs/archive/`.
- Ne pas ecrire "genere a partir du code" ou equivalent sauf si un pipeline d'automatisation existe reellement.
- Pour une PR purement documentaire, `npm run docs:check` est le check par defaut.

Les fichiers critiques du serveur (`lib/smart-cache.js`, `server/services/`) sont documentés en JSDoc — maintenir les annotations `@param` / `@returns` à jour lors de changements de signature.

## Systeme IA

Si le systeme IA (`server/services/ai/`) est modifie:
- Tester avec le script d'audit: `node scripts/audit-ai-explanations.mjs`
- Verifier les metriques AI (taux de fallback, qualite, latence)
- Mettre a jour `wiki/ARCHITECTURE.md` si changement d'architecture
- S'assurer que les fallbacks generiques restent coherents

Architecture actuelle: RAG → Generate (JSON structure) → Validate → Fallback
