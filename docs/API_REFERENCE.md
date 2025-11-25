# API Reference

Base URL front : `VITE_API_URL` si défini, sinon `http://localhost:3001` en dev et `https://inaturamouche.onrender.com` en prod. Toutes les routes sont CORS-allowlist pour ces origines.

## Règles globales
- **Rate-limit** : `/api/*` 300 req / 15 min par IP ; `/api/quiz-question` 60 req / min ; `/api/places*` proxy 120 req / min.  
- **Formats** : requêtes `GET` JSON. Les tableaux peuvent être envoyés en paramètres multiples ou valeurs séparées par des virgules.  
- **Headers utiles** : `X-Cache-Key`, `X-Lure-Buckets`, `X-Pool-*`, `Server-Timing`, `X-Timing` (cf. architecture backend).

## Endpoints

### GET `/api/quiz-question`
- **Params** (Zod `quizSchema`)  
  - `pack_id?`: string (id d'un pack public).  
  - `taxon_ids?`, `include_taxa?`, `exclude_taxa?`: string ou array (ids iNat).  
  - `place_id?`: string ou array.  
  - `nelat?`/`nelng?`/`swlat?`/`swlng?`: number, bbox avec [-90,90] et [-180,180].  
  - `d1?`/`d2?`: string ISO (fenêtre temporelle ou filtre saison via `buildMonthDayFilter`).  
  - `locale`: string, défaut `"fr"`.  
- **200**  
  ```json
  {
    "image_urls": ["https://.../large.jpg"],
    "image_meta": [{ "id": 123, "attribution": "...", "license_code": "cc-by", "url": "...", "original_dimensions": { "width": 1200, "height": 900 } }],
    "bonne_reponse": {
      "id": 12345,
      "name": "Rana temporaria",
      "preferred_common_name": "Grenouille rousse",
      "common_name": "Grenouille rousse",
      "ancestors": [{ "id": 1, "rank": "kingdom", "name": "Plantae" }, ...],
      "wikipedia_url": "https://fr.wikipedia.org/..."
    },
    "choices": [{ "taxon_id": "12345", "label": "Grenouille rousse (Rana temporaria)" }, ...],
    "correct_choice_index": 0,
    "correct_label": "Grenouille rousse (Rana temporaria)",
    "choice_taxa_details": [{ "taxon_id": "12345", "name": "Rana temporaria", "preferred_common_name": "Grenouille rousse", "rank": "species" }],
    "choix_mode_facile": ["Grenouille rousse", "..."],
    "choix_mode_facile_ids": ["12345", "..."],
    "choix_mode_facile_correct_index": 0,
    "inaturalist_url": "https://www.inaturalist.org/observations/..."
  }
  ```
- **Erreurs** : `400` (pack inconnu ou validation), `404` (aucune obs ou pas assez de taxons distincts), `503` (pool indisponible), `429` (rate-limit), `500` (erreur interne).  
- **Headers debug** : `X-Lure-Buckets` (near|mid|far), `X-Pool-Pages`, `X-Pool-Obs`, `X-Pool-Taxa`, `Server-Timing`.

### GET `/api/packs`
- **Params** : aucun.  
- **200** : `[{ id, type, titleKey, descriptionKey }]` (packs publics list/list/dynamic).  

### GET `/api/places`
- **Params** (`placesSchema`)  
  - `q`: string 2..80 chars.  
  - `per_page`: number 1..25, défaut 15.  
- **200** : `[{ id, name, type, admin_level, area_km2 }]`.  
- **Erreurs** : `500` (fallback `[]`). Cache LRU 10 min.

### GET `/api/places/by-id`
- **Params** (`placesByIdSchema`)  
  - `ids`: CSV 1..25 items (string).  
- **200** : même forme que `/api/places`.  
- **Erreurs** : `500` → `[]`.

### GET `/api/taxa/autocomplete`
- **Params** (`autocompleteSchema`)  
  - `q`: string min 2.  
  - `rank?`: string (optionnel).  
  - `locale`: string, défaut `"fr"`.  
- **200** : `[{ id, name, rank, ancestor_ids }]` (nom formaté `common (latin)` si dispo). Cache LRU 10 min.  
- **Erreurs** : `500` `{ error }`.

### GET `/api/taxon/:id`
- **Params** : `id` path int >0, `locale` query string défaut `"fr"`.  
- **200** : Taxon iNat complet (`results[0]`).  
- **Erreurs** : `404` (non trouvé), `400` (id invalide), `500`.

### GET `/api/taxa`
- **Params** (`taxaBatchSchema`)  
  - `ids`: CSV 1..50 items.  
  - `locale`: string, défaut `"fr"`.  
- **200** : tableau de taxons iNat (détails complets).  
- **Erreurs** : `500`.

### GET `/api/observations/species_counts`
- **Params** (`speciesCountsSchema`)  
  - `taxon_ids?` / `include_taxa?` / `exclude_taxa?`: string ou array.  
  - `place_id?`: string.  
  - `nelat?`/`nelng?`/`swlat?`/`swlng?`: number (bbox).  
  - `d1?` / `d2?`: string.  
  - `locale`: string, défaut `"fr"`.  
  - `per_page`: int 1..200 défaut 100.  
  - `page`: int 1..500 défaut 1.  
- **200** : payload iNat `observations/species_counts`.  
- **Erreurs** : `500`, `429` (rate-limit proxy).

### GET `/healthz`
- **200** : `{ ok: true }`.

## Guide d'intégration frontend (`client/src/services/api.js`)

- **Base URL** : calculée à l'exécution (`import.meta.env.VITE_API_URL` > dev localhost:3001 > prod render.com).  
- **`buildSearchParams`** : ignore `undefined|null|""`, joint les arrays par virgules. Accepte aussi un `URLSearchParams` déjà construit.  
- **Annulation & timeout** : `apiGet` crée un `AbortController`, s'abonne à `options.signal` si fourni, et force un abort après `timeout` (8s par défaut) via `DOMException("Timeout","AbortError")`. Les appels (`fetchQuizQuestion`, `autocompleteTaxa`, etc.) propagent le `signal`.  
- **Normalisation** : toutes les valeurs passent par `String().trim()`, les arrays deviennent `a,b,c`. Les erreurs HTTP renvoient une `Error` avec `status` pour que le front affiche `errors.quiz_no_results` sur 404/500.
