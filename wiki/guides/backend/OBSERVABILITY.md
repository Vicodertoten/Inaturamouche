# Observability & Debug

Guide pour déboguer le pipeline et monitorer la performance.

## 📋 Table des matières

1. [Headers de réponse](#headers-de-réponse)
2. [DevTools Network inspection](#devtools-network-inspection)
3. [Logs Pino structurés](#logs-pino-structurés)
4. [Tracing et correlation ID](#tracing-et-correlation-id)
5. [Monitoring et alertes](#monitoring-et-alertes)

---

## 📊 Headers de réponse

### Server-Timing

```http
Server-Timing: fetchObs;dur=150, buildIndex;dur=45, pickTarget;dur=12, buildLures;dur=78, taxa;dur=120, labels;dur=25, total;dur=430
```

**Format** : `label;dur=milliseconds`

| Label | Détail |
|-------|--------|
| `fetchObs` | Fetch observations depuis iNat (paginated) |
| `buildIndex` | Index par taxon (création byTaxon + taxonList) |
| `pickTarget` | Sélection taxon cible (LCA, anti-cooldown) |
| `buildLures` | Génération leurres (LCA bucketing) |
| `taxa` | Fetch détails taxa (Wikipedia, common names) |
| `labels` | Construire labels uniques + shuffle |
| `total` | Temps total du pipeline |

**Interprétation** :
- `total` > 1000ms ? Pipeline lent, check fetchObs ou taxa
- `fetchObs` > 500ms ? iNat API lente ou réseau
- `buildLures` > 100ms ? Pool grand, LCA calcul lourd

### X-Cache-Key

```http
X-Cache-Key: geo=place_7953|month=10,11,12|version=1705340400000
```

Clé utilisée pour lookup questionCache. Utile pour vérifier :
- Normalisation géo correcte ?
- Période normalisée OK ?
- Cache hit/miss pour debug

### X-Selection-Geo

```http
X-Selection-Geo: place_id
```

Mode géo choisi : `place_id`, `bbox`, ou `global`.

**Vérifier** :
- Si utilisateur a spécifié place_id, doit être `place_id`
- Si bbox invalide, fallback `global` ?

### X-Lure-Buckets

```http
X-Lure-Buckets: near=2, mid=1, far=1
```

Distribution LCA buckets pour leurres.

**Interprétation** :
- `near=0` ? Pas d'observations proches taxonomiquement (étonnant)
- `mid=0, far=0` ? Peu de diversité (améliorer pool)
- Idéal : `near=1-2, mid=1-2, far=1` (mélange)

### X-Pool-*

```http
X-Pool-Pages: 5
X-Pool-Obs: 400
X-Pool-Taxa: 87
```

Données iNat chargées :
- `X-Pool-Pages` : Nombre de pages iNat fetched
- `X-Pool-Obs` : Total observations dans pool
- `X-Pool-Taxa` : Taxa distincts

**Diagnostic** :
- `X-Pool-Taxa` < 10 ? Place peu d'observations, filtres trop stricts
- `X-Pool-Pages` = MAX ? Peut augmenter MAX_OBS_PAGES

### X-Lures-Relaxed

```http
X-Lures-Relaxed: false
```

Booléen : fallback relaxed activation ? (pool épuisé, cooldown strict)

- `false` : Sélection normale, OK
- `true` : Deck/cooldown épuisé, utilisé fallback pondéré

### X-Request-Id

```http
X-Request-Id: req-abc123xyz789
```

ID unique pour chaque requête. Tracing dans logs.

### X-RateLimit-*

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 98
X-RateLimit-Reset: 1705340460
```

Rate limiting par IP (iNat + middleware).

---

## 🔍 DevTools Network inspection

### Ouvrir DevTools

1. Ouvrir Firefox/Chrome DevTools (`F12`)
2. Aller à onglet **Network**
3. Recharger page (`Cmd+R`)
4. Cliquer requête `quiz-question`

### Voir les headers

1. Cliquer requête
2. Onglet **Response Headers**
3. Chercher `Server-Timing`, `X-Cache-Key`, etc.

### Visualiser Server-Timing

1. Onglet **Timings** (Firefox) ou **Timing** (Chrome)
2. Voir graph timing par étape

### Calculer latency

```
Response time (DevTools)
= Network latency + Server processing + Browser parsing

Server-Timing (header)
= Server processing only

Network latency
= Response time - Server-Timing total
```

### Exemple analysis

```
Total latency: 800ms
├─ Network: 200ms (client IP loin, latency réseau)
├─ Server: 430ms (Server-Timing)
│  ├─ fetchObs: 150ms (iNat lent)
│  ├─ buildIndex: 45ms
│  ├─ pickTarget: 12ms
│  ├─ buildLures: 78ms (LCA calcul)
│  ├─ taxa: 120ms (fetching Wikipedia)
│  └─ labels: 25ms
└─ Browser: 170ms (parsing JSON, render)

Action: Taxa detail fetch est lent (120ms).
        Vérifier si iNat API locale est chargée.
```

---

## 📝 Logs Pino structurés

### Format JSON

Tous les logs Pino sont JSON pour parsing automatique.

```bash
npm run dev 2>&1 | head -50
```

Exemple log:

```json
{
  "level": 30,
  "time": 1705340400123,
  "pid": 12345,
  "hostname": "macbook-pro",
  "msg": "GET /api/quiz-question",
  "req": {
    "id": "req-abc123",
    "method": "GET",
    "url": "/api/quiz-question?pack=mushrooms&locale=en",
    "remoteAddress": "127.0.0.1",
    "remotePort": 54321
  },
  "res": {
    "statusCode": 200,
    "contentLength": 8234
  },
  "responseTime": 430,
  "quiz": {
    "pack": "mushrooms",
    "locale": "en",
    "cacheKey": "geo=...",
    "cacheHit": false,
    "targetTaxonId": 52367,
    "lureCount": 4
  },
  "cache": {
    "questionCacheSize": 12,
    "selectionStateCacheSize": 8,
    "hit": false,
    "revalidated": false
  },
  "timing": {
    "fetchObs": 150,
    "buildIndex": 45,
    "pickTarget": 12,
    "buildLures": 78,
    "taxa": 120,
    "labels": 25,
    "total": 430
  },
  "lures": {
    "buckets": { "near": 2, "mid": 1, "far": 1 },
    "relaxed": false
  },
  "pool": {
    "pages": 5,
    "obs": 400,
    "taxa": 87
  }
}
```

### Filtering logs

```bash
# Voir seulement quiz-question requests
npm run dev 2>&1 | jq 'select(.msg | contains("quiz-question"))'

# Voir requêtes lentes (> 500ms)
npm run dev 2>&1 | jq 'select(.responseTime > 500)'

# Voir erreurs
npm run dev 2>&1 | jq 'select(.level >= 40)'  # warn=40, error=50, fatal=60

# Voir cache hits
npm run dev 2>&1 | jq 'select(.cache.hit == true)'

# Timeline per taxon
npm run dev 2>&1 | jq '.quiz.targetTaxonId' | sort | uniq -c
```

### Log levels

| Level | Value | Usage |
|-------|-------|-------|
| trace | 10 | Très verbose, ne pas en prod |
| debug | 20 | Infos debug (cache lookup, normalization) |
| info | 30 | Évènements normaux (requests, responses) |
| warn | 40 | Problèmes non-critiques (pool petit, fallback) |
| error | 50 | Erreurs (API fail, validation error) |
| fatal | 60 | Critique (crash imminent) |

---

## 🔗 Tracing et correlation ID

### X-Request-Id

Chaque requête reçoit unique ID pour tracer à travers logs:

```javascript
// server.js
app.use(pinoHttp({
  genReqId: () => `req-${generateId()}`,
}));

// Dans handler
app.get('/api/quiz-question', (req, res) => {
  const requestId = req.id;  // "req-abc123"
  logger.info({ requestId, msg: 'Processing quiz request' });
  // ...
});
```

### Tracing exemple

Request arrives:
```
2025-01-15T10:30:00.123Z [req-abc123] GET /api/quiz-question?pack=mushrooms
2025-01-15T10:30:00.273Z [req-abc123] Cache miss, fetching observations
2025-01-15T10:30:00.429Z [req-abc123] Building index (87 taxa)
2025-01-15T10:30:00.553Z [req-abc123] Response 200 OK, 430ms
```

Chercher dans logs: `grep "req-abc123"`

---

## 📈 Monitoring et alertes

### Prometheus metrics (futur)

```javascript
// Exemple: Exposer métriques pour Prometheus scraping

const prom = require('prom-client');

// Metrics
const requestDuration = new prom.Histogram({
  name: 'quiz_request_duration_ms',
  help: 'Quiz request duration in milliseconds',
  buckets: [100, 250, 500, 1000, 2000, 5000],
  labelNames: ['cache_hit'],
});

const cacheHitRate = new prom.Gauge({
  name: 'quiz_cache_hit_rate',
  help: 'Cache hit rate (0-1)',
});

const poolSize = new prom.Gauge({
  name: 'quiz_pool_size',
  help: 'Current observation pool size',
  labelNames: ['pack'],
});

// Usage
const timer = requestDuration.startTimer();
// ... process request ...
timer({ cache_hit: cacheHit });

// Expose endpoint
app.get('/metrics', (req, res) => {
  res.set('Content-Type', prom.register.contentType);
  res.end(prom.register.metrics());
});
```

### Key metrics to monitor

| Metric | Target | Alert |
|--------|--------|-------|
| Request latency (p99) | < 1000ms | > 2000ms |
| Cache hit rate | > 70% | < 50% |
| iNat API error rate | < 1% | > 5% |
| Pool taxa count | > 50 | < 10 |
| Lure diversity (far bucket) | > 0 | = 0 |

### Alerting rules (Prometheus)

```yaml
groups:
  - name: inaturamouche
    rules:
      - alert: QuizLatencySlow
        expr: histogram_quantile(0.99, quiz_request_duration_ms) > 2000
        for: 5m
        annotations:
          summary: "Quiz endpoint p99 latency > 2s"

      - alert: CacheHitRateLow
        expr: quiz_cache_hit_rate < 0.5
        for: 10m
        annotations:
          summary: "Cache hit rate < 50%"

      - alert: iNatApiErrors
        expr: rate(inaturalist_api_errors[5m]) > 0.05
        for: 5m
        annotations:
          summary: "iNat API error rate > 5%"
```

### Dashboard Grafana

Example queries:

```
# Average latency by cache hit
avg(quiz_request_duration_ms) by (cache_hit)

# Cache hit rate over time
quiz_cache_hit_rate

# Request rate
rate(quiz_requests_total[1m])

# Pool size distribution
histogram_quantile(0.95, quiz_pool_size)
```

---

## 🎯 Common debugging scenarios

### Scénario 1: Requête lente (> 1000ms)

```
Checklist:
1. Vérifier Server-Timing (quelle étape est lente ?)
2. Si fetchObs lent (> 300ms)
   → iNat API lente ou réseau mauvais
   → Vérifier X-Pool-Pages (combien fetched ?)
   → Possiblement augmenter MAX_OBS_PAGES ?
3. Si taxa lent (> 200ms)
   → Fetch Wikipedia lent
   → Vérifier taxonDetailsCache hit rate
   → Possibly pre-warm cache
4. Si buildLures lent (> 150ms)
   → Beaucoup d'observations, LCA calcul lourd
   → Optimiser calcul ou cache LCA
```

### Scénario 2: Pool petit (< 20 taxa)

```
Checklist:
1. Vérifier X-Pool-Taxa header
2. Vérifier X-Pool-Obs (combien observations total ?)
3. Filtres trop stricts ?
   → place_id + taxon_ids + période ?
   → Tester sans filtres pour verifier
4. iNat API retourne peu d'observations ?
   → Vérifier X-Pool-Pages (fetching enough ?)
   → Vérifier paramètres GET iNat (correct format ?)
5. Données iNat anciennes pour cette place
```

### Scénario 3: Pas de leurres near (X-Lure-Buckets: near=0)

```
Checklist:
1. Pool trop petit ? (besoin diversity)
2. Filtre period bloque observations proches ?
3. LCA bucketing broken ?
   → Verifier ancestors data dans observations
   → Test buildLures algo indépendemment
4. Possible solution : élargir filtres
```

### Scénario 4: Cache miss fréquent

```
Checklist:
1. Vérifier X-Cache-Key (correct ?)
2. Utilisateurs utilisent différents filtres chaque fois ?
   → Cache fragmentation (peu réutilisation)
3. TTL trop court ? (expiry rapide)
4. Cache size trop petit ? (eviction)
   → Vérifier questionCache size dans logs
5. Vérifier cache revalidation en BG (SWR)
   → Log "revalidated": true ?
```

---

## 📚 Ressources

- [ARCHITECTURE.md](../ARCHITECTURE.md) – Vue d'ensemble + Server-Timing diagram
- [CACHE_STRATEGY.md](./CACHE_STRATEGY.md) – Cache internals
- [QUIZ_PIPELINE.md](./QUIZ_PIPELINE.md) – Algorithmes détail
