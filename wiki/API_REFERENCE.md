# API Reference

Contrats complets des routes exposées par l'API Inaturamouche.

## 📋 Table des matières

1. [Endpoints](#endpoints)
2. [Erreurs](#erreurs)
3. [Headers](#headers)
4. [Exemples cURL](#exemples-curl)

---

## 🔌 Endpoints

### `GET /api/quiz-question`

Récupère une question de quizz avec leurres LCA.

#### Request

**Query parameters** :

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `pack` | string | — | Pack prédéfini : `common_european_mushrooms`, `common_european_trees` |
| `taxon_ids` | string (CSV) | — | IDs iNaturalist à inclure (ex: `1,2,3`) |
| `place_id` | number | — | Place iNaturalist ID pour géofiltrage |
| `bbox` | string | — | Bounding box : `min_lon,min_lat,max_lon,max_lat` |
| `taxon_month_window` | string | — | Fenêtre saisonnière : `MM-MM` (ex: `10-03` = Oct→Mar) |
| `lure_count` | number | 4 | Nombre de leurres (défaut 4) |
| `locale` | string | `en` | Langue : `en`, `fr`, `nl` |

#### Response (200 OK)

```json
{
  "id": "q-abc123xyz",
  "images": [
    {
      "url": "https://static.inaturalist.org/photos/123/medium.jpg",
      "license": "CC-BY-NC",
      "photographer": "John Doe",
      "taxon_geoprivacy": null
    }
  ],
  "taxon": {
    "id": 52367,
    "name": "Amanita muscaria",
    "common_name": "Fly Agaric",
    "ancestors": [
      { "id": 2, "name": "Animalia", "rank": "kingdom" },
      { "id": 47126, "name": "Fungi", "rank": "kingdom" },
      { "id": 47124, "name": "Agaricales", "rank": "order" },
      { "id": 52361, "name": "Amanitaceae", "rank": "family" },
      { "id": 52362, "name": "Amanita", "rank": "genus" }
    ],
    "wikipedia_url": "https://en.wikipedia.org/wiki/Amanita_muscaria",
    "inaturalist_url": "https://www.inaturalist.org/taxa/52367"
  },
  "choices": [
    {
      "taxonId": 52367,
      "label": "Amanita muscaria",
      "difficulty": "easy"
    },
    {
      "taxonId": 47126,
      "label": "Amanita virosa",
      "difficulty": "hard"
    },
    {
      "taxonId": 52368,
      "label": "Amanita pantherina",
      "difficulty": "hard"
    },
    {
      "taxonId": 52369,
      "label": "Amanita phalloides",
      "difficulty": "hard"
    }
  ],
  "easyChoices": [
    {
      "taxonId": 52367,
      "label": "Fly Agaric",
      "difficulty": "easy"
    },
    {
      "taxonId": 47126,
      "label": "Destroying Angel",
      "difficulty": "easy"
    },
    {
      "taxonId": 52368,
      "label": "Panther Cap",
      "difficulty": "easy"
    },
    {
      "taxonId": 52369,
      "label": "Death Cap",
      "difficulty": "easy"
    }
  ]
}
```

#### Headers réponse

```http
HTTP/1.1 200 OK
Server-Timing: fetchObs;dur=150, buildIndex;dur=45, pickTarget;dur=12, buildLures;dur=78, taxa;dur=120, labels;dur=25, total;dur=430
X-Cache-Key: geo=place_1234|month=10,11,12|version=1705340400000
X-Selection-Geo: place_id
X-Lure-Buckets: near=2, mid=1, far=1
X-Pool-Pages: 5
X-Pool-Obs: 400
X-Pool-Taxa: 87
X-Lures-Relaxed: false
X-Request-Id: req-abc123xyz789
X-Response-Time: 430ms
```

---

### `GET /api/taxa/autocomplete`

Autocomplétion pour recherche taxa.

#### Request

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `q` | string | Oui | Query search (ex: `amanita`) |
| `locale` | string | Non | `en`, `fr`, `nl` (défaut `en`) |

```bash
GET /api/taxa/autocomplete?q=amanita&locale=en
```

#### Response (200 OK)

```json
[
  {
    "id": 52367,
    "name": "Amanita muscaria",
    "common_name": "Fly Agaric",
    "rank": "species",
    "matched_term": "amanita"
  },
  {
    "id": 52362,
    "name": "Amanita",
    "common_name": null,
    "rank": "genus",
    "matched_term": "amanita"
  }
]
```

---

### `GET /api/places`

Récupère places iNaturalist pour géofiltrage.

#### Request

| Param | Type | Description |
|-------|------|-------------|
| `q` | string | Nom du lieu (ex: `France`) |
| `locale` | string | Langue |

#### Response

```json
[
  {
    "id": 7953,
    "name": "France",
    "place_type": 12,
    "display_name": "France"
  },
  {
    "id": 123456,
    "name": "Île-de-France",
    "place_type": 8,
    "display_name": "Île-de-France, France"
  }
]
```

---

### `GET /api/observations/species_counts`

Compte d'espèces observées par taxa/place.

#### Request

| Param | Type | Description |
|-------|------|-------------|
| `place_id` | number | Place iNat ID |
| `taxon_ids` | string (CSV) | Taxa IDs |

#### Response

```json
{
  "total": 1250,
  "by_taxon": {
    "52367": 123,
    "52368": 98,
    "47126": 456
  }
}
```

---

### `GET /api/health`

Health check.

#### Response (200 OK)

```json
{
  "status": "ok",
  "timestamp": "2025-01-15T10:30:00Z",
  "uptime": 3600
}
```

---

## ⚠️ Erreurs

Les erreurs sont retournées avec un structure standardisée.

### Format erreur

```json
{
  "error": {
    "code": "INVALID_PACK",
    "message": "Pack not found: invalid_pack"
  }
}
```

### Codes d'erreur courants

| Code | Status | Description | Solution |
|------|--------|-------------|----------|
| `INVALID_PACK` | 400 | Pack inexistant | Utiliser pack valide |
| `INVALID_PLACE_ID` | 400 | Place ID invalide | Vérifier place_id avec `/api/places` |
| `INVALID_BBOX` | 400 | Bbox format incorrect | Format: `min_lon,min_lat,max_lon,max_lat` |
| `NO_OBSERVATIONS` | 503 | Aucune observation trouvée | Élargir filtres (place, période) |
| `INATURALIST_API_ERROR` | 503 | API iNat indisponible | Retry après quelques secondes |
| `INATURALIST_RATE_LIMITED` | 429 | Rate limit iNat atteint | Attendre quelques minutes |
| `CACHE_EXPIRED` | 500 | Erreur cache interne | Retry la requête |
| `INTERNAL_SERVER_ERROR` | 500 | Erreur serveur | Contacter mainteneurs, check logs |

### Exemple erreur

```bash
curl -s "http://localhost:3001/api/quiz-question?pack=invalid" | jq .
```

```json
{
  "error": {
    "code": "INVALID_PACK",
    "message": "Pack not found: invalid"
  }
}
```

---

## 📊 Headers

### Request headers (optionnel)

```http
GET /api/quiz-question?pack=...
Accept: application/json
Accept-Language: en
X-Request-ID: req-123  # Pour tracing
User-Agent: Inaturamouche/1.0
```

### Response headers (debug)

| Header | Exemple | Description |
|--------|---------|-------------|
| `Server-Timing` | `fetchObs;dur=150` | Timing pipeline (voir [OBSERVABILITY](./guides/backend/OBSERVABILITY.md)) |
| `X-Cache-Key` | `geo=place_123\|month=10,11` | Clé cache utilisée |
| `X-Selection-Geo` | `place_id`, `bbox`, `global` | Mode géographique |
| `X-Lure-Buckets` | `near=2, mid=1, far=1` | Distribution LCA |
| `X-Pool-Pages` | `5` | Pages iNat chargées |
| `X-Pool-Obs` | `400` | Observations dans pool |
| `X-Pool-Taxa` | `87` | Taxa distincts |
| `X-Lures-Relaxed` | `false` | Fallback anti-répétition activé |
| `X-Request-Id` | `req-abc123xyz` | ID requête pour tracing |
| `X-Response-Time` | `430ms` | Temps réponse total |
| `Cache-Control` | `no-cache, no-store` | Politique cache |
| `X-RateLimit-Limit` | `100` | Limite requêtes/min |
| `X-RateLimit-Remaining` | `98` | Requêtes restantes |

---

## 🔨 Exemples cURL

### 1. Question simple (pack par défaut)

```bash
curl -s "http://localhost:3001/api/quiz-question?pack=common_european_mushrooms&locale=en" | jq '.taxon | {id, name, common_name}'
```

### 2. Avec géofiltrage (place)

```bash
curl -s "http://localhost:3001/api/quiz-question?pack=common_european_mushrooms&place_id=7953&locale=fr" | jq '.taxon'
```

### 3. Avec bounding box

```bash
curl -s "http://localhost:3001/api/quiz-question?pack=common_european_trees&bbox=2.22,48.81,2.47,48.90&locale=fr" | jq '.taxon'
```

### 4. Avec fenêtre saisonnière

```bash
# Champignons de printemps (mars-mai)
curl -s "http://localhost:3001/api/quiz-question?pack=common_european_mushrooms&taxon_month_window=03-05&locale=en" | jq '.taxon'
```

### 5. Taxa spécifiques

```bash
# Seulement Amanita (52362) et Boletus (52411)
curl -s "http://localhost:3001/api/quiz-question?taxon_ids=52362,52411&locale=en" | jq '.taxon'
```

### 6. Avec leurres personnalisés

```bash
curl -s "http://localhost:3001/api/quiz-question?pack=common_european_mushrooms&lure_count=6&locale=en" | jq '.choices | length'
```

### 7. Autocomplete

```bash
curl -s "http://localhost:3001/api/taxa/autocomplete?q=bolet&locale=fr" | jq '.[] | {name, common_name}'
```

### 8. Places

```bash
curl -s "http://localhost:3001/api/places?q=Switzerland" | jq '.[] | {id, name}'
```

### 9. Inspecter headers timing

```bash
curl -s -D - "http://localhost:3001/api/quiz-question?pack=mushrooms" 2>&1 | grep -E "(Server-Timing|X-Lure|X-Pool)"
```

Output :
```
Server-Timing: fetchObs;dur=123, buildIndex;dur=34, pickTarget;dur=8, buildLures;dur=56, taxa;dur=98, labels;dur=19, total;dur=338
X-Cache-Key: geo=place_1234|month=...
X-Lure-Buckets: near=2, mid=1, far=1
X-Pool-Pages: 3
X-Pool-Obs: 240
X-Pool-Taxa: 65
```

### 10. Rate limit

```bash
for i in {1..200}; do
  curl -s "http://localhost:3001/api/quiz-question?pack=mushrooms" > /dev/null
  echo "Request $i"
done

# Vérifier rate limit header
curl -s -D - "http://localhost:3001/api/quiz-question?pack=mushrooms" 2>&1 | grep X-RateLimit
```

---

## 📈 Versioning

Actuellement : **v1** (pas de versioning explicite d'URL)

Routes : `/api/*`

Futur versioning prévu :
- `/api/v1/*` (backward compat)
- `/api/v2/*` (breaking changes)

---

## 🔐 Sécurité

### CORS

```bash
curl -s -H "Origin: https://attacker.com" \
  -H "Access-Control-Request-Method: POST" \
  "http://localhost:3001/api/quiz-question"
```

CORS est configuré (voir `server.js`) : accepte toutes origines en dev, restrictif en prod.

### Rate limiting

- **iNaturalist calls** : 1000 req/hour (iNat limit)
- **Client requests** : 100 req/min par IP (middleware `express-rate-limit`)

### Validation

Toutes les entrées validées avec **Zod** :
- Types contrôlés
- Ranges vérifiés
- Strings échappées

---

## 🚀 Performance

### Timeouts

- iNaturalist API call : 30 secondes
- Prefetch : 10 secondes
- Total pipeline : 60 secondes

### Cache

Voir [CACHE_STRATEGY.md](./guides/backend/CACHE_STRATEGY.md) pour détails TTL, SWR, limites.

### Optimisations

- Chunked iNat fetching (80 obs/page)
- Lazy taxa details (Wikipedia fetch seulement si needed)
- Prefetch question suivante (réduction UX latency)

---

## 📚 Ressources complémentaires

- [ARCHITECTURE.md](./ARCHITECTURE.md) – Pipeline détail + diagrammes
- [OBSERVABILITY.md](./guides/backend/OBSERVABILITY.md) – Debugging headers
- [QUIZ_PIPELINE.md](./guides/backend/QUIZ_PIPELINE.md) – Algorithmes LCA, anti-répétition
