# AGENT.md

Guide de travail pour les agents IA qui interviennent sur iNaturaQuizz.
Ce fichier est volontairement court. Il sert de cadre d'execution, pas de reference technique exhaustive.

## Documentation canonique

Utiliser la documentation dans cet ordre :

1. `README.md` : vue produit, quickstart, liens utiles
2. `wiki/` : point d'entree canonique et guides courts
3. `docs/reference/` : contrats, valeurs exactes, formats
4. `docs/explanation/` : architecture, flux, arbitrages

`docs/archive/` contient des notes internes, historiques ou d'audit. Ces fichiers restent utiles au mainteneur, mais ils ne sont pas canoniques.

## Invariants produit

- iNaturaQuizz est un quiz naturaliste pedagogique, privacy-first, sans compte obligatoire.
- Les modes actifs sont `easy` et `hard`.
- L'IA produit est une couche optionnelle d'explication. Le quiz et la progression doivent rester utiles sans elle.
- Les routes ou reliquats archives (`riddle`, `taxonomic`, leaderboard daily) ne doivent pas revenir dans la narration produit par accident.
- Le front est une SPA React/PWA. Le back est une API Express. En production, le front est servi par Netlify et l'API par Fly.io.

## Cartographie rapide

- `client/` : interface, routes, PWA, i18n, etat local, tests frontend
- `server/` : API, quiz, rounds, IA, metrics, packs, securite
- `shared/` : logique partagee
- `lib/` : utilitaires Node-only
- `scripts/` : audits, validations, outils ops
- `wiki/` et `docs/` : documentation

## Regles de travail

- Explorer avant de modifier. Lire seulement les fichiers necessaires.
- Faire le plus petit changement coherent possible.
- Ne pas refactorer large par opportunisme.
- Preserver les changements non lies deja presents dans le repo.
- Mettre a jour la doc canonique si architecture, API, IA, ops, scripts, packs, ou comportement public changent.
- Ne pas pretendre qu'une doc est "generee" s'il n'existe pas de pipeline d'automatisation reel.
- Si une note interne est utile mais non canonique, la placer dans `docs/archive/`.

## Validation minimale

| Type de tache | Checks minimum |
| --- | --- |
| Frontend | `npm --prefix client run lint`, `npm --prefix client run test -- --run`, `npm --prefix client run build` si build/routage/PWA touches |
| Backend / API | `npm run lint:server`, `npm run test:unit`, `npm run test:integration` selon la zone touchee |
| Contrat API ou securite | checks backend + tests integration + doc mise a jour |
| IA | `npm run lint:server`, checks cibles, `node scripts/audit-ai-explanations.mjs` |
| Documentation seule | `npm run docs:check` puis relecture contre le code |
| Changement large | `npm run ci` |

## Orchestration

- Agent unique par defaut.
- Deleguer seulement les taches paralleles, bornees et peu couplees.
- Repartir les write scopes clairement : `client/`, `server/`, `docs/`, `scripts/`.
- Garder une verification finale unique pour les invariants, les checks et la coherence de la doc.

## Definition de done

Le travail est termine si :

- la demande est implemente ou documentee de facon coherente
- les checks adaptes ont ete lances, ou explicitement non lances avec raison
- les invariants produit et techniques sont respectes
- la documentation canonique est alignee avec le code
- les notes internes sont hors du parcours canonique

## Commandes utiles

- `npm run docs:check`
- `npm run check:i18n`
- `npm run lint:server`
- `npm --prefix client run lint`
- `npm run test:unit`
- `npm run test:integration`
- `npm --prefix client run test -- --run`
- `npm --prefix client run build`
- `npm run ci`

Ce fichier ne change aucun contrat runtime. Il formalise le cadre de contribution des agents IA sur ce depot.
