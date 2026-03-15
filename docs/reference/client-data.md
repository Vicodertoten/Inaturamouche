# Client Data Reference

> **Source de vérité** — Généré à partir de `client/src/services/db.js`, `client/src/services/PlayerProfile.js`, `client/vite.config.js`, `client/src/services/apiErrors.js`.

---

## 1. IndexedDB (Dexie)

> Source : `client/src/services/db.js`

### Base de données

- **Nom** : `inaturalist_quiz`
- **Librairie** : Dexie v4 (wrapper IndexedDB)
- **Version actuelle** : 8

### Historique des versions

| Version | Changements principaux |
|---------|----------------------|
| 3 | Schéma initial : `taxa`, `stats`, `collection`, `species`, `taxonomy_cache`, `taxon_groups` |
| 4 | Index `taxa.name`, composites `stats.[iconic_taxon_id+masteryLevel]` et `[iconic_taxon_id+lastSeenAt]`. Migration : populate `iconic_taxon_id` sur stats |
| 5 | Table `active_session` pour pause/resume |
| 6 | Champs Spaced Repetition sur stats : `nextReviewDate`, `reviewInterval`, `easeFactor` |
| 7 | Champs rareté sur taxa : `rarity_tier`, `observations_count`. Migration : calcul `rarity_tier` |
| 8 | Table `profiles` — unification sur Dexie. Migration depuis legacy IDB `inaturamouche-player` |

### Schéma v8 (actuel)

#### Table `taxa` — Encyclopédie des espèces

```
PK: id (iNaturalist taxon ID)
Index: iconic_taxon_id, updatedAt, name, rarity_tier, observations_count
```

| Champ | Type | Description |
|-------|------|-------------|
| `id` | number | PK — ID iNaturalist |
| `iconic_taxon_id` | number | Groupe taxonomique (filtrage) |
| `updatedAt` | string/number | Timestamp de dernière mise à jour |
| `name` | string | Nom (indexé pour recherche textuelle) |
| `rarity_tier` | string | Catégorie de rareté dérivée |
| `observations_count` | number | Nombre brut d'observations iNaturalist |

#### Table `stats` — Progression par espèce

```
PK: id (même que taxa.id)
Index: iconic_taxon_id, [iconic_taxon_id+masteryLevel], [iconic_taxon_id+lastSeenAt], lastSeenAt, nextReviewDate
```

| Champ | Type | Description |
|-------|------|-------------|
| `id` | number | PK — ID taxon |
| `iconic_taxon_id` | number | Groupe taxonomique (dénormalisé) |
| `masteryLevel` | number | Niveau de maîtrise (0-4) |
| `lastSeenAt` | string | Date de dernière rencontre |
| `nextReviewDate` | string | Date de prochaine révision (SR) |
| `reviewInterval` | number | Intervalle actuel en jours |
| `easeFactor` | number | Facteur de difficulté Anki-like |

#### Table `active_session` — Session de jeu en cours

```
PK: id (toujours 1)
```

Stocke une seule session active pour permettre pause/resume : `currentQuestionIndex`, `score`, `history`, `gameConfig`, `timestamp`.

#### Table `profiles` — Profil joueur

```
PK: key (toujours 'playerProfile')
```

Stocke le profil joueur complet (voir [scoring-progression.md](scoring-progression.md#6-player-profile) pour le schéma).

#### Tables legacy (conservées pour migration)

| Table | PK | Description |
|-------|-----|-------------|
| `collection` | `taxon_id` | Ancienne collection (migrée vers `stats`) |
| `species` | `id` | Ancienne table espèces (migrée vers `taxa`) |
| `taxonomy_cache` | `id` | Cache phylogénétique |
| `taxon_groups` | `id` | Cache groupes taxonomiques |

### Helpers exportés

| Fonction | Description |
|----------|-------------|
| `getStats(taxonId)` | Récupère les stats d'un taxon |
| `getTaxon(taxonId)` | Récupère les données d'un taxon |
| `getTaxonWithStats(taxonId)` | Récupère taxon + stats combinés |
| `checkStorageQuota()` | Vérifie le quota de stockage disponible |
| `checkSpaceBeforeWrite(estimatedSize)` | Vérifie l'espace avant écriture (marge 10%) |

---

## 2. PWA Service Worker (Workbox)

> Source : `client/vite.config.js` — plugin `vite-plugin-pwa`

### Configuration

- **Register type** : `autoUpdate`
- **Mode** : `production` (sourcemaps désactivées)
- **Cleanup** : caches obsolètes nettoyés automatiquement
- **Fallback SPA** : `/api/` exclu (`navigateFallbackDenylist: [/^\/api\//]`)

### Runtime Caching Rules

| # | Pattern | Strategy | Cache Name | TTL | Max Entries |
|---|---------|----------|------------|-----|-------------|
| 0 | `*.woff2` | CacheFirst | `fonts-cache` | 1 an | 10 |
| 1 | `/api/taxa/autocomplete`, `/api/observations/species_counts` | StaleWhileRevalidate | `api-meta-swr` | 1h | 300 |
| 2 | `/api/quiz-question` (exact) | NetworkOnly | `api-quiz-no-cache` | — | — |
| 3 | `/api/*` (catch-all) | NetworkOnly | `api-no-cache` | — | — |
| 4 | `static.inaturalist.org/photos/*` | CacheFirst | `inat-photos` | 7 jours | 400 |
| 5 | `inaturalist-open-data.s3.amazonaws.com/*` | CacheFirst | `inat-photos-legacy` | 7 jours | 200 |

### Stratégies expliquées

| Stratégie | Comportement |
|-----------|-------------|
| **CacheFirst** | Cache d'abord, réseau en fallback. Idéal pour contenus statiques. |
| **StaleWhileRevalidate** | Sert le cache immédiatement, revalide en arrière-plan. Équilibre fraîcheur/performance. |
| **NetworkOnly** | Toujours réseau. Empêche de resservir des questions déjà vues ou des données stale. |

### PWA Manifest

```json
{
  "name": "iNaturaQuizz",
  "short_name": "iNatura",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#0E7C86"
}
```

---

## 3. Error Codes (i18n client)

> Source : `client/src/services/apiErrors.js`

### Mapping server code → client key

| Code serveur | Clé client |
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

### Messages traduits

| Clé | FR | EN | NL |
|-----|-----|-----|-----|
| `internal` | Erreur interne du serveur | Internal server error | Interne serverfout |
| `bad_request` | Paramètres invalides | Bad request | Ongeldige parameters |
| `not_found` | Introuvable | Not Found | Niet gevonden |
| `pool_unavailable` | Aucune observation trouvée... | No observations found... | Geen waarnemingen gevonden... |
| `inat_unavailable` | Service iNaturalist temporairement indisponible | The iNaturalist service is temporarily unavailable | De iNaturalist-service is tijdelijk niet beschikbaar |
| `inat_timeout` | Service iNaturalist lent | The iNaturalist service is currently slow | De iNaturalist-service reageert momenteel traag |
| `taxonomy_not_found` | Taxon non trouvé | Taxon not found | Taxon niet gevonden |
| `generic` | Une erreur est survenue... | Something went wrong... | Er ging iets mis... |
| `rate_limited` | Trop de requêtes | Too many requests | Te veel verzoeken |

### Langues supportées : `fr`, `en`, `nl`

Le registre est volontairement léger (~10 traductions) pour éviter d'importer les locales complètes (~2200 lignes) dans le client réseau.

---

## 4. Build & Chunks

> Source : `client/vite.config.js` → `build.rollupOptions`

### Manual Chunks

| Chunk | Contenu |
|-------|---------|
| `router` | `react-router-dom` |
| `zz_leaflet` | `leaflet`, `react-leaflet`, `@react-leaflet` |
| `d3` | `d3` (toutes les sous-libs) |
| `vendor` | Tous les autres `node_modules` |

### Path Aliases

| Alias | Résolution |
|-------|-----------|
| `@` | `./src` |
| `@components` | `./src/components` |
| `@pages` | `./src/pages` |
| `@services` | `./src/services` |
| `@contexts` | `./src/context` |
| `@hooks` | `./src/hooks` |
| `@utils` | `./src/utils` |
| `@features` | `./src/features` |
| `@shared` | `./src/shared` |
| `@styles` | `./src/styles` |
| `@locales` | `./src/locales` |

---

## 5. Legacy Migration

> Source : `client/src/services/PlayerProfile.js`

### Chaîne de migration

1. **localStorage** (`inaturamouche_playerProfile`) → IDB profiles
2. **Legacy IDB** (`inaturamouche-player`) → Dexie profiles
3. **Profile fields** : `totalScore` → `xp`
4. **Dexie v3→v8** : voir [section 1](#1-indexeddb-dexie)

La migration est transparente : au premier chargement, le profil est automatiquement migré depuis l'ancien format.
