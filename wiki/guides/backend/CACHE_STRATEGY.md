# Cache Strategy

Caches backend en memoire (SmartCache).

## Caches utilises

- Pool de questions (observations + index taxons)
- Autocomplete (taxa/places)
- Details taxons
- Selection state par client
- Queue de questions pre-generees
- Round store + dedupe soumissions

## Parametres principaux

Config via env (voir `.env.example`):

- `QUESTION_CACHE_TTL_MS`
- `QUESTION_CACHE_STALE_TTL_MS`
- `AUTOCOMPLETE_CACHE_TTL_MS`
- `AUTOCOMPLETE_CACHE_STALE_TTL_MS`
- `TAXON_DETAILS_CACHE_TTL_MS`
- `TAXON_DETAILS_CACHE_STALE_TTL_MS`
- `SELECTION_STATE_TTL_MS`
- `MAX_*_CACHE_ENTRIES`

## Comportement

- cache in-memory par instance
- prune regulier appele dans les routes
- stale/fresh selon TTL

## Limites actuelles

- non partage entre instances
- perte au redemarrage

Pour un vrai scaling horizontal, migrer les caches critiques vers Redis.
