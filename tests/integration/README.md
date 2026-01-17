# Tests d'intégration API

Ce dossier contient les tests d'intégration pour l'API du backend Inaturamouche.

## Structure

Les tests sont organisés par route API :

- **health.test.mjs** - Tests pour l'endpoint de santé (`/healthz`)
- **packs.test.mjs** - Tests pour les packs de questions (`/api/packs`)
- **places.test.mjs** - Tests pour la recherche de lieux (`/api/places`)
- **quiz.test.mjs** - Tests pour la génération de questions de quiz (`/api/quiz-question`)
- **taxa.test.mjs** - Tests pour la recherche taxonomique (`/api/taxa/*`, `/api/taxon/:id`, `/api/observations/species_counts`)

## Exécution des tests

```bash
# Exécuter tous les tests d'intégration
npm run test:integration

# Exécuter uniquement les tests unitaires
npm run test:unit

# Exécuter tous les tests (unitaires + intégration + frontend)
npm run test:all
```

## Architecture des tests

Les tests d'intégration :
- Démarrent un serveur HTTP éphémère sur un port aléatoire
- Mockent les appels à l'API iNaturalist avec `globalThis.fetch`
- Testent les endpoints avec de vraies requêtes HTTP
- Vérifient les codes de statut, les structures de réponse et les validations

## Mocking de l'API iNaturalist

Les tests utilisent un système de mock pour `globalThis.fetch` qui :
- Laisse passer les requêtes vers le serveur de test local
- Intercepte et simule les appels à l'API iNaturalist
- Permet de tester les cas d'erreur et les réponses vides

Exemple :
```javascript
globalThis.fetch = async (url, opts) => {
  // Laisser passer les requêtes vers notre serveur de test
  if (String(url).startsWith(baseUrl)) return originalFetch(url, opts);
  
  // Mocker les réponses de l'API iNaturalist
  if (String(url).includes('/observations')) {
    return {
      ok: true,
      status: 200,
      json: async () => ({ results: [...] })
    };
  }
};
```

## Couverture des tests

### Health (`/healthz`)
- ✅ Retourne 200 avec `{ ok: true }`
- ✅ Retourne le bon content-type JSON

### Packs (`/api/packs`)
- ✅ Retourne la liste des packs
- ✅ Structure valide des packs (id, type, titleKey, descriptionKey)
- ✅ Inclut les différents types de packs (custom, list, dynamic)
- ✅ Données consistantes entre plusieurs requêtes

### Places (`/api/places`, `/api/places/by-id`)
- ✅ Validation des paramètres requis
- ✅ Autocomplete avec pagination
- ✅ Récupération par IDs (single et multiple)
- ✅ Gestion des erreurs (retourne tableau vide)

### Quiz (`/api/quiz-question`)
- ✅ Validation des paramètres requis
- ✅ Validation du pack_id
- ✅ Support de taxon_ids, place_id, bounding box
- ✅ Support des dates (d1, d2)
- ✅ Support du seed pour résultats déterministes
- ✅ Support du locale
- ✅ Gestion du cas 503 POOL_UNAVAILABLE

### Taxa (`/api/taxa/*`, `/api/taxon/:id`, `/api/observations/species_counts`)
- ✅ Autocomplete avec validation
- ✅ Support du rank et locale
- ✅ Détail d'un taxon par ID
- ✅ Gestion du 404 pour taxon inexistant
- ✅ Batch de taxons
- ✅ Species counts avec pagination et filtres géographiques

## Ajout de nouveaux tests

Pour ajouter des tests pour un nouveau endpoint :

1. Créer un nouveau fichier `*.test.mjs` dans ce dossier
2. Suivre la structure des tests existants (before/after hooks)
3. Mocker les appels à l'API iNaturalist si nécessaire
4. Tester les cas nominaux ET les cas d'erreur

## Bonnes pratiques

- ✅ Utiliser `test.before()` et `test.after()` pour setup/teardown
- ✅ Restaurer `globalThis.fetch` après chaque test
- ✅ Tester les codes de statut HTTP
- ✅ Tester les structures de réponse
- ✅ Tester les cas d'erreur (400, 404, 500, 503)
- ✅ Tester la validation des paramètres
- ✅ Éviter les dépendances entre tests (chaque test doit être indépendant)
