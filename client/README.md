# 🦋 Inaturamouche – Frontend

> Application React PWA pour quiz naturaliste basé sur iNaturalist

Ce dossier contient l'application cliente d'Inaturamouche, construite avec React 19, Vite et configurée comme Progressive Web App (PWA) offline-first.

## 📦 Scripts disponibles

```bash
# Développement (démarre le serveur Vite sur :5173)
npm run dev

# Build de production (sortie dans /dist)
npm run build

# Prévisualiser le build de production
npm run preview

# Linting avec ESLint
npm run lint

# Tests unitaires (Node test runner)
npm test
```

## 🏗️ Architecture frontend

### Structure du projet

```
src/
├── components/       # Composants réutilisables (ImageViewer, Autocomplete, etc.)
├── pages/           # Pages principales (HomePage, PlayPage, EndPage, ProfilePage)
├── context/         # Contextes React (GameContext, UserContext, LanguageContext)
├── features/        # Features complexes organisées par domaine
├── services/        # Services API et clients externes
├── hooks/           # Custom hooks React
├── locales/         # Fichiers i18n (fr.js, en.js, nl.js)
├── styles/          # Styles globaux et thèmes CSS
├── utils/           # Utilitaires (formatters, validators, etc.)
├── core/            # Configuration et constantes
└── shared/          # Types et interfaces partagés
```

### Technologies principales

| Technologie | Usage |
|-------------|-------|
| **React 19** | Framework UI avec hooks et context API |
| **Vite** | Build tool et dev server (HMR ultra-rapide) |
| **React Router** | Routing client-side (`/`, `/play`, `/end`, `/profile`) |
| **Vite-PWA** | Configuration Service Worker et offline-first |
| **D3.js** | Rendu de l'arbre phylogénétique (mode difficile) |
| **Leaflet** | Cartes interactives pour les filtres géographiques |
| **Dexie** | Wrapper IndexedDB pour persistance locale (achievements, scores) |

### State management

L'application utilise React Context pour la gestion d'état :

- **`GameContext`** : État du jeu (question actuelle, score, streak, mode facile/difficile)
- **`UserContext`** : Profil utilisateur, achievements, XP, préférences
- **`LanguageContext`** : Locale active (fr/en/nl) et traductions

### PWA et stratégies de cache

Configuration dans [vite.config.js](vite.config.js) :

- **Service Worker** : Auto-update silencieux (`registerType: 'autoUpdate'`)
- **API de quiz** : `NetworkOnly` (toujours frais, évite les questions répétées)
- **Metadata API** : `StaleWhileRevalidate` (réactivité, cache 1h)
- **Images iNaturalist** : `CacheFirst` (cache 7 jours, limite 400 entrées)

### Routes disponibles

| Route | Page | Description |
|-------|------|-------------|
| `/` | `HomePage` | Lobby, configurateur de filtres, sélection packs |
| `/play` | `PlayPage` | Quiz actif (mode facile ou difficile) |
| `/end` | `EndPage` | Récapitulatif de session et achievements |
| `/profile` | `ProfilePage` | Statistiques, XP, maîtrise par taxon/biome |

## 🌐 Internationalisation (i18n)

L'application supporte 3 langues : **Français (fr)**, **English (en)**, **Nederlands (nl)**.

Les traductions se trouvent dans [src/locales/](src/locales/) :
- `fr.js` – Français (locale par défaut)
- `en.js` – English
- `nl.js` – Nederlands

### Ajouter/modifier une traduction

1. Ajouter la clé dans **les 3 fichiers** de locale
2. Vérifier la parité : `npm run check:i18n` (depuis la racine)
3. Utiliser la clé dans le code : `t('nouvelle.cle')`

## 🧪 Tests

Tests unitaires avec Node test runner :
```bash
npm test
```

Tests couverts :
- Formatters (`formatters.test.mjs`)
- Scoring et XP (`scoring.test.mjs`)
- API client et gestion d'erreurs (`api.test.mjs`, `api-errors.test.mjs`)
- Reducers (`filterReducer.test.mjs`)

## 🔗 Liens vers la documentation complète

### Guides frontend
- [GAME_STATE.md](../wiki/guides/frontend/GAME_STATE.md) – GameContext, lifecycle, AbortController
- [PWA_OFFLINE.md](../wiki/guides/frontend/PWA_OFFLINE.md) – Service Worker, cache policies
- [FRONTEND_GUIDE.md](../docs/FRONTEND_GUIDE.md) – Guide complet frontend (composants, PWA, etc.)

### Documentation générale
- [README principal](../README.md) – Vue d'ensemble du projet
- [ARCHITECTURE.md](../wiki/ARCHITECTURE.md) – Architecture complète avec diagrammes
- [API_REFERENCE.md](../docs/API_REFERENCE.md) – Contrats d'API backend
- [CONTRIBUTING.md](../CONTRIBUTING.md) – Contribuer au projet

## 🚀 Développement

### Démarrer en mode développement

1. Assurer que le backend tourne sur `:3001` (voir [server/README.md](../server/README.md))
2. Lancer le client :
   ```bash
   npm run dev
   ```
3. Ouvrir http://localhost:5173

Le proxy Vite redirige automatiquement `/api/*` vers `http://localhost:3001`.

### Variables d'environnement

Créer un fichier `.env` dans `/client` (optionnel) :

```env
# URL de l'API backend (défaut: http://localhost:3001 en dev)
VITE_API_URL=http://localhost:3001
```

En production, Netlify injecte automatiquement `VITE_API_URL` via les build settings.

## 📦 Build de production

```bash
npm run build
```

Le build de production est généré dans `/dist` avec :
- Bundle optimisé et minifié
- Service Worker pour le mode offline
- Assets pré-chargés (manifest, fonts, icons)
- Source maps pour debugging

## 🐛 Debugging

### Outils de développement

- **React DevTools** : Inspecter components, context, hooks
- **Redux DevTools** : Pas utilisé (on utilise Context API)
- **Vite DevTools** : HMR et module graph
- **Lighthouse** : Auditer les performances PWA

### Headers debug côté API

L'API retourne des headers utiles pour le debugging :
- `X-Cache-Key` : Clé de cache utilisée
- `X-Lure-Buckets` : Distribution des leurres (near/mid/far)
- `Server-Timing` : Temps de traitement par étape

Consulter [OBSERVABILITY.md](../wiki/guides/backend/OBSERVABILITY.md) pour plus de détails.

## 🤝 Contribuer

Voir [CONTRIBUTING.md](../CONTRIBUTING.md) pour les conventions de code, workflow i18n et tests.

Les contributions sont les bienvenues ! Merci de :
- Respecter la structure des dossiers existante
- Ajouter des tests pour les nouvelles fonctionnalités
- Maintenir la parité i18n (3 langues)
- Documenter les composants complexes

---

**Questions ?** → Ouvrir une issue sur GitHub ou consulter la documentation complète dans `/wiki/`.
