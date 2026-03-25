# Securite des rounds

> Comment le serveur garde la reponse correcte cote backend, sans session utilisateur classique.

## Objectifs

Le systeme doit :

- cacher la bonne reponse avant soumission
- verifier qu'une soumission n'a pas ete forgee
- empecher la re-soumission abusive
- expirer les rounds anciens
- garder une logique serveur-authoritative pour `easy` et `hard`

## Round signe

Fichier principal: `server/services/roundStore.js`

Chaque question cree un round temporaire contenant notamment :

- `roundId`
- `clientId`
- `gameMode`
- `correctTaxonId`
- `expiresAt`
- `nonce`
- `finalized`
- `lastResult`
- etat specifique au mode (`hardState` si besoin)

Le client recoit :

- `round_id`
- `round_signature`
- les choix affichables

Il ne recoit pas la bonne reponse.

## Signature HMAC

Le serveur signe un payload stable avec `ROUND_HMAC_SECRET`.

Principes :

- recalcul de signature cote serveur a la soumission
- comparaison en temps constant
- liaison au client et a l'expiration du round

## Protections principales

| Menace | Protection |
|--------|------------|
| Lecture de la reponse avant validation | bonne reponse jamais envoyee |
| Soumission forgee | HMAC + verification serveur |
| Timing attack | comparaison timing-safe |
| Double clic / retry reseau | cache de deduplication |
| Rejeu d'un round deja resolu | `finalized` + `lastResult` |
| Round trop ancien | TTL -> `410 ROUND_EXPIRED` |

## Soumission active

### Easy

- une tentative utile
- reponse correcte ou incorrecte
- finalisation immediate

### Hard

- plusieurs guesses possibles
- le serveur maintient `hardState`
- la logique de score depend des guesses restants
- finalisation a la bonne reponse ou a l'epuisement des guesses

## Reliquats archives

Les actions et modes archives (`riddle`, `taxonomic`, `taxonomic_select`, `taxonomic_hint`) existent encore dans certaines validations ou structures internes, mais le produit actif ne les presente plus.

Quand ils sont appeles via l'API publique, le comportement attendu reste un `410 MODE_ARCHIVED` ou equivalent.

## Balance et observabilite

Une fois un round resolu, le backend peut pousser un evenement de balance pour alimenter le dashboard de snapshot.
