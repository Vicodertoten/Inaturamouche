# Client Data Reference

> Reference maintenue contre `client/src/services/db.js`, `client/src/services/PlayerProfile.js`, `client/vite.config.js` et `client/src/services/apiErrors.js`.

## 1. IndexedDB / Dexie

- Librairie: Dexie v4
- Nom de la base: `inaturalist_quiz`
- Version de schema courante: `8`

### Tables actives

| Table | Cle | Role |
|-------|-----|------|
| `taxa` | `id` | Encyclopedie locale des taxons |
| `stats` | `id` | Progression et revision par espece |
| `active_session` | `id` | Sauvegarde d'une partie en cours |
| `profiles` | `key` | Profil joueur (`playerProfile`) |

### Tables legacy conservees pour migration

| Table | Role |
|-------|------|
| `collection` | Ancienne progression par espece |
| `species` | Ancienne table taxons |
| `taxonomy_cache` | Cache taxonomique |
| `taxon_groups` | Ancienne structure de groupes |

### Evolutions de schema utiles

| Version | Changement |
|---------|------------|
| 3 | Base `taxa` / `stats` + tables legacy |
| 4 | Index de recherche et denormalisation `iconic_taxon_id` |
| 5 | Table `active_session` |
| 6 | Champs de spaced repetition sur `stats` |
| 7 | Rarete sur `taxa` |
| 8 | Table `profiles` et unification du profil dans Dexie |

## 2. Profil joueur

Stockage:

- table `profiles`
- cle unique: `playerProfile`

Blocs principaux du profil:

- `xp`
- `stats` : parties, precisions, packs joues, streaks, missed species
- `achievements`
- `pokedex`
- `dailyStreak`
- `rewards`

Migrations supportees:

- `localStorage` -> Dexie
- ancienne base IndexedDB `inaturamouche-player` -> Dexie
- champ legacy `totalScore` -> `xp`

## 3. PWA / Service Worker

Configuration: `client/vite.config.js`

| Pattern | Strategie | Cache |
|---------|-----------|-------|
| `*.woff2` | `CacheFirst` | `fonts-cache` |
| `/api/taxa/autocomplete`, `/api/observations/species_counts` | `StaleWhileRevalidate` | `api-meta-swr` |
| `/api/quiz-question` | `NetworkOnly` | `api-quiz-no-cache` |
| `/api/*` | `NetworkOnly` | `api-no-cache` |
| `static.inaturalist.org/photos/*` | `CacheFirst` | `inat-photos` |
| `inaturalist-open-data.s3.amazonaws.com/*` | `CacheFirst` | `inat-photos-legacy` |

Manifest principal:

- `name`: `iNaturaQuizz`
- `short_name`: `iNatura`
- `start_url`: `/`
- `display`: `standalone`
- `theme_color`: `#0E7C86`

## 4. Etat frontend persistant vs transient

- React Context: `Game`, `User`, `Language`, `Packs`
- Zustand: `useGameMetaStore` pour XP/streak/achievements de session
- `useReducer`: filtres custom
- Dexie: profil, encyclopedie, stats, reprise de session

## 5. Codes d'erreur client

Mapping principal depuis `client/src/services/apiErrors.js` :

| Code serveur | Cle client |
|-------------|------------|
| `INTERNAL_SERVER_ERROR` | `internal` |
| `BAD_REQUEST` | `bad_request` |
| `NOT_FOUND` | `not_found` |
| `POOL_UNAVAILABLE` | `pool_unavailable` |
| `INAT_UNAVAILABLE` | `inat_unavailable` |
| `INAT_TIMEOUT` | `inat_timeout` |
| `TAXON_NOT_FOUND` | `taxonomy_not_found` |
| `ROUND_EXPIRED` | `generic` |
| `INVALID_ROUND_SIGNATURE` | `generic` |
| `EXPLAIN_RATE_LIMIT_EXCEEDED` | `rate_limited` |
| `EXPLAIN_DAILY_QUOTA_EXCEEDED` | `rate_limited` |
| `REPORT_RATE_LIMIT_EXCEEDED` | `rate_limited` |

## 6. Build frontend

Path aliases declares dans `client/vite.config.js` :

- `@`
- `@components`
- `@pages`
- `@services`
- `@contexts`
- `@hooks`
- `@utils`
- `@features`
- `@shared`
- `@styles`
- `@locales`

Decoupage manuel des chunks:

- `router`
- `zz_leaflet`
- `vendor`

Une regle `d3` existe encore dans la config, mais elle n'est pas active tant qu'aucune dependance `d3` n'est embarquee.
