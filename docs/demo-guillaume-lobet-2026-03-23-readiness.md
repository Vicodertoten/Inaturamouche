# Demo Readiness Checklist - Guillaume Lobet - 2026-03-23

## Mode de demo

- Mode garanti: `brief-first`
- Mode optionnel: `full` photo uniquement si la repetition locale est verte
- Regle de decision: si un doute subsiste, rester en `brief-only`

## Kill switches

- API prod: `AI_EXPLANATION_FULL_ENABLED=false`
- API prod: `AI_EXPLANATION_FULL_IMAGE_AWARE=false`
- Front prod: `VITE_AI_EXPLANATION_FULL_ENABLED=false`

## Checks avant depart

1. Lancer l'API locale.
2. Verifier le smoke local.
3. Prechauffer 2 a 3 explications `brief`.
4. Verifier qu'une mauvaise reponse affiche toujours un `brief` utile.
5. Ne tester `full` qu'en bonus, jamais en chemin principal.

## Commandes

```bash
npm run metrics:archive:reset
node server/index.js
bash scripts/smoke-test.sh http://localhost:3001
npm run beta:smoke
```

## Repetition locale

- Utiliser le pack reel de demo et la langue reelle.
- Faire au maximum 5 mauvaises reponses volontaires.
- Verifier `0` fallback `client_timeout`.
- Verifier `0` erreur `429` pendant la repetition.

## Condition d'activation du full local

- 3 paires de demo preselectionnees.
- 2 runs consecutifs sans fallback par paire.
- Aucun `429`.
- Temps de rendu inferieur a 8 secondes.

Si une seule condition echoue, masquer le `full` aussi en local.

## Script de presentation

1. Poser une question.
2. Laisser une erreur volontaire.
3. Montrer le `brief`.
4. Corriger la confusion.
5. N'ouvrir l'analyse photo que si tout est stable.
