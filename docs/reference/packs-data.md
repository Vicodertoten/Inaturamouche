# Packs & Data Reference

> **Source de vérité** — Généré à partir de `server/packs/index.js`, `server/packs/places.js`, `server/packs/taxa.js`, `server/packs/tags.js`, `shared/data/*.json`.

---

## 1. Concepts

### Types de packs

| Type | Description | Source des taxons |
|------|-------------|-------------------|
| `custom` | Pack libre — le joueur compose ses propres critères | Aucune taxa_ids, paramètres API dynamiques |
| `list` | Pack curateur — liste fixe de taxons (fichier JSON) | `taxa_ids[]` (IDs iNaturalist extraits des fichiers `shared/data/`) |
| `dynamic` | Pack dynamique — requête iNaturalist à la volée | `api_params` (taxon_id, place_id, popular, threatened, sounds, month) |

### PackDefinition (typedef)

> Source : `server/packs/index.js`

```typescript
interface PackDefinition {
  id: string;                                          // Identifiant unique
  type: 'custom' | 'list' | 'dynamic';                // Type de source
  titleKey: string;                                    // Clé i18n du titre
  descriptionKey: string;                              // Clé i18n de la description
  region?: 'belgium' | 'france' | 'europe' | 'world'; // Région géographique
  category: 'starter' | 'regional' | 'world' |        // Catégorie thématique
            'threatened' | 'curated' | 'fun' |
            'expert' | 'custom';
  level: 'beginner' | 'intermediate' | 'advanced';    // Difficulté
  visibility: 'home' | 'catalog' | 'legacy';          // Exposition UI
  sortWeight: number;                                  // Tri (poids bas = affiché en premier)
  taxa_ids?: number[];                                 // IDs pour type=list
  api_params?: Record<string, string>;                 // Params pour type=dynamic
  theme?: string;                                      // Thème visuel
  tags?: string[];                                     // Tags libres
  healthMinTaxa?: number;                              // Min taxons pour santé du pack
}
```

### Visibilité

| Valeur | Description |
|--------|-------------|
| `home` | Affiché sur la page d'accueil (sections) |
| `catalog` | Affiché dans le catalogue complet |
| `legacy` | Caché (anciens packs conservés pour compatibilité) |

### Feature Flag : `PACKS_V3_ENABLED`

- **Défaut** : `true`
- Si `false` : les packs utilisent une **rollback visibility map** qui réduit la liste visible à ~28 packs (fallback V2)
- Variable d'environnement : `PACKS_V3_ENABLED`

---

## 2. Catalogue des packs

### Répartition

| Métrique | Valeur |
|----------|--------|
| Total packs | 62 (dont 1 custom) |
| Type `dynamic` | 44 |
| Type `list` | 16 |
| Type `custom` | 1 |

### Pack Custom

| ID | Type | Category | Visibility |
|----|------|----------|------------|
| `custom` | custom | custom | home |

### Packs World (dynamic)

| ID | Category | Level | Visibility |
|----|----------|-------|------------|
| `world_birds` | starter | beginner | home |
| `world_mammals` | starter | beginner | home |
| `world_plants` | starter | beginner | home |
| `world_fungi` | starter | beginner | home |
| `amazing_insects` | starter | beginner | home |
| `world_herps` | world | intermediate | home |
| `world_fish` | world | intermediate | home |

### Packs Europe (dynamic)

| ID | Category | Level | Visibility |
|----|----------|-------|------------|
| `europe_birds` | regional | beginner | home |
| `europe_mammals` | regional | beginner | home |
| `europe_plants` | regional | beginner | home |
| `europe_fungi` | regional | intermediate | home |

### Packs Belgique (dynamic)

| ID | Category | Level | Visibility |
|----|----------|-------|------------|
| `belgium_starter_mix` | starter | beginner | home |
| `belgium_birds` | regional | beginner | home |
| `belgium_plants` | regional | beginner | home |

### Packs Threatened (dynamic)

| ID | Region | Category | Level | Visibility |
|----|--------|----------|-------|------------|
| `world_threatened_birds` | world | threatened | intermediate | home |
| `world_threatened_mammals` | world | threatened | intermediate | home |
| `world_threatened_insects` | world | threatened | intermediate | home |
| `world_threatened_plants` | world | threatened | intermediate | home |
| `world_threatened_fish` | world | threatened | intermediate | home |
| `world_threatened_herps` | world | threatened | intermediate | home |
| `europe_threatened_birds` | europe | threatened | intermediate | home |
| `europe_threatened_mammals` | europe | threatened | intermediate | home |
| `europe_threatened_insects` | europe | threatened | intermediate | home |
| `europe_threatened_plants` | europe | threatened | intermediate | home |
| `belgium_threatened_birds` | belgium | threatened | intermediate | home |
| `belgium_threatened_mammals` | belgium | threatened | intermediate | home |

### Packs Curated (list — fichiers JSON)

| ID | Region | Category | Level | Visibility | Dataset entries |
|----|--------|----------|-------|------------|-----------------|
| `belgium_edible_plants` | belgium | curated | intermediate | home | 60 |
| `belgium_edible_flowers` | belgium | curated | intermediate | home | 20 |
| `europe_edible_plants` | europe | curated | intermediate | home | 61 |
| `world_edible_plants_basics` | world | curated | beginner | home | 57 |
| `mediterranean_edible_plants` | europe | curated | intermediate | home | 26 |
| `belgium_edible_mushrooms` | belgium | curated | intermediate | home | 39 |
| `europe_edible_mushrooms` | europe | curated | intermediate | home | 42 |
| `world_edible_mushrooms_basics` | world | curated | beginner | home | 25 |
| `belgium_toxic_mushrooms` | belgium | curated | advanced | home | 15 |
| `europe_toxic_mushrooms` | europe | curated | advanced | home | 20 |
| `world_medicinal_plants` | world | curated | intermediate | home | 39 |
| `europe_medicinal_plants` | europe | curated | intermediate | home | 30 |
| `europe_invasive_plants` | europe | curated | intermediate | home | 17 |
| `europe_lookalikes_edible_vs_toxic_mushrooms` | europe | curated | advanced | home | 20 |

### Packs Fun (dynamic)

| ID | Region | Category | Visibility |
|----|--------|----------|------------|
| `europe_dragons_and_monsters` | europe | fun | home |
| `world_weird_invertebrates` | world | fun | home |
| `europe_autumn_colors` | europe | fun | home |
| `world_night_choir` | world | fun | home |

### Packs Legacy (dynamic)

| ID | Region | Category | Level | Visibility |
|----|--------|----------|-------|------------|
| `european_trees` | europe | curated | beginner | legacy |
| `european_mushrooms` | europe | curated | beginner | legacy |
| `france_mammals` | france | regional | beginner | legacy |
| `belgium_wildflowers` | belgium | regional | beginner | legacy |
| `belgium_mammals` | belgium | regional | beginner | legacy |
| `belgium_trees` | belgium | regional | beginner | legacy |
| `belgium_herps` | belgium | expert | intermediate | legacy |
| `mediterranean_flora` | europe | regional | intermediate | legacy |
| `belgium_butterflies` | belgium | expert | intermediate | legacy |
| `belgium_mushrooms` | belgium | expert | intermediate | legacy |
| `belgium_dragonflies` | belgium | expert | advanced | legacy |
| `belgium_spiders` | belgium | expert | advanced | legacy |
| `belgium_fish` | belgium | expert | intermediate | legacy |
| `belgium_beetles` | belgium | expert | advanced | legacy |
| `belgium_mosses_lichens` | belgium | expert | advanced | legacy |
| `belgium_mollusks` | belgium | expert | advanced | legacy |

---

## 3. Rollback Visibility Map (V2 fallback)

Quand `PACKS_V3_ENABLED=false`, seuls ces packs restent visibles :

| Visibilité `home` (17 packs) | Visibilité `catalog` (11 packs) |
|------|------|
| `belgium_starter_mix` | `world_herps` |
| `world_birds` | `world_fish` |
| `world_mammals` | `europe_fungi` |
| `world_plants` | `belgium_herps` |
| `world_fungi` | `mediterranean_flora` |
| `amazing_insects` | `belgium_butterflies` |
| `european_trees` | `belgium_mushrooms` |
| `european_mushrooms` | `belgium_dragonflies` |
| `france_mammals` | `belgium_spiders` |
| `europe_birds` | `belgium_fish` |
| `europe_mammals` | `belgium_beetles` |
| `europe_plants` | `belgium_mosses_lichens` |
| `belgium_birds` | `belgium_mollusks` |
| `belgium_plants` | |
| `belgium_wildflowers` | |
| `belgium_mammals` | |
| `belgium_trees` | |

Tous les autres packs → `visibility: 'legacy'` (cachés).

---

## 4. Datasets (shared/data/)

Fichiers JSON partagés, utilisés par les packs de type `list`.

### Schéma

```json
[
  {
    "scientific_name": "Urtica dioica",
    "common_name": "Grande ortie",
    "inaturalist_id": "51884"
  }
]
```

| Champ | Type | Description |
|-------|------|-------------|
| `scientific_name` | string | Nom scientifique Latin |
| `common_name` | string | Nom vernaculaire (généralement FR) |
| `inaturalist_id` | string | ID iNaturalist du taxon |

### Inventaire

| Fichier | Entrées | Pack associé |
|---------|---------|--------------|
| `belgian_edible_plants.json` | 60 | `belgium_edible_plants` |
| `belgium_edible_flowers.json` | 20 | `belgium_edible_flowers` |
| `belgium_edible_mushrooms.json` | 39 | `belgium_edible_mushrooms` |
| `belgium_toxic_mushrooms.json` | 15 | `belgium_toxic_mushrooms` |
| `common_european_mushrooms.json` | 49 | `european_mushrooms` (legacy) |
| `common_european_trees.json` | 50 | `european_trees` (legacy) |
| `europe_edible_mushrooms.json` | 42 | `europe_edible_mushrooms` |
| `europe_edible_plants.json` | 61 | `europe_edible_plants` |
| `europe_invasive_plants.json` | 17 | `europe_invasive_plants` |
| `europe_lookalikes_edible_vs_toxic_mushrooms.json` | 20 | `europe_lookalikes_edible_vs_toxic_mushrooms` |
| `europe_medicinal_plants.json` | 30 | `europe_medicinal_plants` |
| `europe_toxic_mushrooms.json` | 20 | `europe_toxic_mushrooms` |
| `mediterranean_edible_plants.json` | 26 | `mediterranean_edible_plants` |
| `world_edible_mushrooms_basics.json` | 25 | `world_edible_mushrooms_basics` |
| `world_edible_plants_basics.json` | 57 | `world_edible_plants_basics` |
| `world_medicinal_plants.json` | 39 | `world_medicinal_plants` |

**Total** : 16 fichiers, 570 espèces référencées.

---

## 5. Helpers (server/packs/)

### places.js

Expose `PLACES` (dictionnaire de place IDs iNaturalist) et `toPlaceId()`.

### taxa.js

Expose `TAXA` (dictionnaire de taxon IDs iNaturalist par groupe), `TAXON_SETS` (combinaisons), et `csvTaxonIds()`.

### tags.js

Expose `PACK_TAGS` et `normalizePackTags()` pour la normalisation des tags de pack.
