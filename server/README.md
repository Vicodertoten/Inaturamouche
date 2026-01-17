# Architecture Modulaire du Serveur

## Structure

```
server/
├── index.js              # Point d'entrée (démarre le serveur)
├── app.js                # Configuration Express (middleware, CORS, Helmet)
├── config/
│   ├── index.js          # Variables d'environnement centralisées
│   └── cors.js           # Configuration CORS
├── middleware/
│   ├── rateLimiter.js    # Rate limiting (api, quiz, proxy)
│   ├── logging.js        # Pino HTTP logger
│   └── errorHandler.js   # Gestion d'erreurs globale
├── routes/
│   ├── index.js          # Router principal (combine tous les routers)
│   ├── quiz.js           # /api/quiz-question
│   ├── taxa.js           # /api/taxa/* (autocomplete, detail, batch, species_counts)
│   ├── places.js         # /api/places/* (autocomplete, by-id)
│   ├── packs.js          # /api/packs
│   └── health.js         # /healthz
├── services/
│   ├── iNaturalistClient.js   # Fetch vers iNaturalist avec retry/timeout/circuit breaker
│   ├── observationPool.js     # Gestion du pool d'observations
│   ├── lureBuilder.js         # Algorithme LCA pour leurres (stratégie hybride)
│   ├── questionGenerator.js   # Orchestration de génération de questions
│   └── selectionState.js      # État de sélection par client (cooldown, history)
├── cache/
│   ├── questionCache.js       # Cache des pools de questions
│   ├── selectionCache.js      # Cache des états de sélection
│   ├── taxonDetailsCache.js   # Cache des détails de taxons
│   ├── autocompleteCache.js   # Cache de l'autocomplétion
│   └── similarSpeciesCache.js # Cache des espèces similaires
└── utils/
    ├── validation.js          # Schémas Zod pour validation
    └── helpers.js             # Fonctions utilitaires

```

## Points d'Entrée

- **`server/index.js`** : Démarre le serveur HTTP (appelle `createApp()` de `app.js`)
- **`server/app.js`** : Configure et exporte l'application Express

## Configuration

Toute la configuration est centralisée dans `server/config/index.js` :
- Variables d'environnement (PORT, TRUST_PROXY_LIST, etc.)
- TTL des caches
- Limites et seuils (rate limits, pool size, etc.)

## Services

### iNaturalistClient
- `fetchJSON()` : Fetch brut avec retry et timeout
- `fetchInatJSON()` : Fetch avec circuit breaker
- `getFullTaxaDetails()` : Récupère les détails de taxons avec cache
- `fetchSimilarSpeciesWithTimeout()` : Espèces similaires avec timeout strict

### observationPool
- `fetchObservationPoolFromInat()` : Récupère les observations depuis iNaturalist
- `getObservationPool()` : Gère le cache du pool d'observations
- `sanitizeObservation()` : Nettoie et normalise les observations

### lureBuilder
- `buildLures()` : Génère les leurres avec stratégie hybride (API similar_species + LCA)

### questionGenerator
- `buildQuizQuestion()` : Orchestre la génération complète d'une question
- `getQueueEntry()` / `fillQuestionQueue()` : Pré-génération de questions

### selectionState
- `createSelectionState()` : Crée l'état initial pour un client
- `getSelectionStateForClient()` : Récupère ou crée l'état d'un client
- `pickObservationForTaxon()` : Sélectionne une observation pour un taxon
- Gestion du cooldown et de l'historique

## Cache

Tous les caches utilisent `SmartCache` de `lib/smart-cache.js` avec :
- TTL fresh et stale
- Prune automatique
- Background refresh

## Middleware

- **rateLimiter** : 3 limiteurs (API global, quiz, proxy)
- **logging** : Logs HTTP structurés avec Pino
- **errorHandler** : Gestion des erreurs 404 et globales

## Routes

Chaque router gère un domaine fonctionnel :
- **health** : Health check simple
- **packs** : Liste des packs de quiz
- **quiz** : Génération de questions (endpoint principal)
- **taxa** : Autocomplétion, détails, batch, species_counts
- **places** : Autocomplétion et détails de lieux

## Tests

Lancez les tests avec :
```bash
npm test
```

Les tests sont dans `/tests` et testent principalement les utilitaires (`lib/quiz-utils.js`) et certains services.

## Développement

```bash
# Démarrer en mode dev avec rechargement automatique
npm run dev

# Démarrer en mode production
npm start
```

## Migration depuis server.js monolithique

L'ancien fichier `server.js` (68KB) a été divisé en modules fonctionnels pour :
- **Maintenabilité** : Chaque module a une responsabilité claire
- **Testabilité** : Les services peuvent être testés indépendamment
- **Évolutivité** : Facile d'ajouter de nouvelles routes ou services
- **Lisibilité** : Code organisé et facile à naviguer

Le fichier original a été sauvegardé dans `server.js.backup`.
