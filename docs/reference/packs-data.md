# Packs & Data Reference

> Reference maintenue contre `server/packs/index.js`, `server/packs/places.js`, `server/packs/taxa.js`, `server/packs/tags.js` et `shared/data/*.json`.

## 1. Concepts

### Types de packs

| Type | Description | Source des taxons |
|------|-------------|-------------------|
| `custom` | Pack libre compose cote client | Pas de `taxa_ids`, criteres dynamiques |
| `dynamic` | Pack calcule a partir d'une requete iNaturalist | `api_params` |
| `list` | Pack a liste fixe | `taxa_ids[]` issus de `shared/data/*.json` |

### Visibilite

| Valeur | Effet |
|--------|-------|
| `home` | Expose directement sur la Home |
| `catalog` | Expose dans le catalogue complet |
| `legacy` | Conserve pour compatibilite, non mis en avant |

### Feature flag

`PACKS_V3_ENABLED=true` par defaut.

- `true` : expose le catalogue courant
- `false` : applique une carte de rollback de visibilite sans casser les `pack_id` historiques

## 2. Etat actuel du catalogue

| Metrique | Valeur |
|----------|--------|
| Definitions totales | 61 |
| Packs actifs | 44 |
| Packs legacy | 16 |
| Entree custom | 1 |
| Entrees `home` | 12 |
| Entrees `catalog` | 33 |
| Packs actifs `dynamic` | 30 |
| Packs actifs `list` | 14 |

## 3. Inventaire exact par visibilite et type

### `home | custom`

- `custom`

### `home | dynamic`

- `belgium_starter_mix`
- `world_birds`
- `world_mammals`
- `world_plants`
- `world_fungi`
- `amazing_insects`
- `europe_birds`
- `europe_mammals`
- `europe_plants`
- `belgium_birds`
- `belgium_plants`

### `catalog | dynamic`

- `world_herps`
- `world_fish`
- `europe_fungi`
- `world_threatened_birds`
- `world_threatened_mammals`
- `world_threatened_insects`
- `world_threatened_plants`
- `world_threatened_fish`
- `world_threatened_herps`
- `europe_threatened_birds`
- `europe_threatened_mammals`
- `europe_threatened_insects`
- `europe_threatened_plants`
- `belgium_threatened_birds`
- `belgium_threatened_mammals`
- `europe_dragons_and_monsters`
- `world_weird_invertebrates`
- `europe_autumn_colors`
- `world_night_choir`

### `catalog | list`

- `belgium_edible_plants`
- `belgium_edible_flowers`
- `europe_edible_plants`
- `world_edible_plants_basics`
- `mediterranean_edible_plants`
- `belgium_edible_mushrooms`
- `europe_edible_mushrooms`
- `world_edible_mushrooms_basics`
- `belgium_toxic_mushrooms`
- `europe_toxic_mushrooms`
- `world_medicinal_plants`
- `europe_medicinal_plants`
- `europe_invasive_plants`
- `europe_lookalikes_edible_vs_toxic_mushrooms`

### `legacy | list`

- `european_trees`
- `european_mushrooms`

### `legacy | dynamic`

- `france_mammals`
- `belgium_wildflowers`
- `belgium_mammals`
- `belgium_trees`
- `belgium_herps`
- `mediterranean_flora`
- `belgium_butterflies`
- `belgium_mushrooms`
- `belgium_dragonflies`
- `belgium_spiders`
- `belgium_fish`
- `belgium_beetles`
- `belgium_mosses_lichens`
- `belgium_mollusks`

## 4. Datasets `shared/data/`

Schema attendu :

```json
[
  {
    "scientific_name": "Urtica dioica",
    "common_name": "Grande ortie",
    "inaturalist_id": "51884"
  }
]
```

| Fichier | Entrees |
|---------|---------|
| `belgian_edible_plants.json` | 60 |
| `belgium_edible_flowers.json` | 20 |
| `belgium_edible_mushrooms.json` | 39 |
| `belgium_toxic_mushrooms.json` | 15 |
| `common_european_mushrooms.json` | 49 |
| `common_european_trees.json` | 50 |
| `europe_edible_mushrooms.json` | 42 |
| `europe_edible_plants.json` | 61 |
| `europe_invasive_plants.json` | 17 |
| `europe_lookalikes_edible_vs_toxic_mushrooms.json` | 20 |
| `europe_medicinal_plants.json` | 30 |
| `europe_toxic_mushrooms.json` | 20 |
| `mediterranean_edible_plants.json` | 26 |
| `world_edible_mushrooms_basics.json` | 25 |
| `world_edible_plants_basics.json` | 57 |
| `world_medicinal_plants.json` | 39 |

## 5. Helpers cote serveur

- `server/packs/places.js` : place IDs iNaturalist
- `server/packs/taxa.js` : taxons et ensembles taxonomiques
- `server/packs/tags.js` : normalisation des tags

Pour la liste exhaustive des definitions et de leurs champs, la reference de code reste `server/packs/index.js`.
