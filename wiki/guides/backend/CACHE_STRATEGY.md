# Cache Strategy – SmartCache Architecture

Stratégie complète de caching pour optimiser performance et distribuer la charge iNaturalist.

## 📋 Table des matières

1. [SmartCache architecture](#smartcache-architecture)
2. [TTL et SWR](#ttl-et-swr)
3. [Chaque cache expliqué](#chaque-cache-expliqué)
4. [Circuit Breaker](#circuit-breaker)
5. [Limitations actuelles](#limitations-actuelles)
6. [Solutions futures](#solutions-futures)

---

## 🏗️ SmartCache architecture

### Concept: LRU + SWR (Stale-While-Revalidate)

**LRU (Least Recently Used)** : Quand la limite de mémoire est atteinte, supprimer l'entrée la moins récemment utilisée.

**SWR (Stale-While-Revalidate)** : Servir une valeur expirée au client **immédiatement**, puis mettre à jour l'entrée en arrière-plan.

```
Requête pour clé K:
  ├─ Clé en cache ?
  │  ├─ Pas expiée (TTL OK) → Servir + mettre à jour LRU
  │  ├─ Expiée mais SWR OK → Servir + revalidate en BG
  │  └─ SWR expiré → Fetch frais, stocker
  └─ Pas en cache → Fetch, stocker, servir
```

### Implémentation

```javascript
// lib/smart-cache.js
class SmartCache {
  constructor(maxSize = 100) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.accessOrder = [];  // Pour LRU
  }

  get(key) {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const now = Date.now();

    // TTL expiré et SWR expiré
    if (now > entry.staleTtlExpiry) {
      this.cache.delete(key);
      return null;
    }

    // Mettre à jour LRU
    this.updateAccessOrder(key);

    // Retourner la valeur (peut être stale)
    return entry.value;
  }

  set(key, value, options = {}) {
    const {
      ttl = 5 * 60 * 1000,              // 5 min par défaut
      staleTtl = 3 * ttl,               // 15 min stale
    } = options;

    const now = Date.now();

    const entry = {
      value,
      createdAt: now,
      ttlExpiry: now + ttl,
      staleTtlExpiry: now + staleTtl,
    };

    this.cache.set(key, entry);
    this.updateAccessOrder(key);

    // Nettoyer si dépassement
    if (this.cache.size > this.maxSize) {
      this.evictLRU();
    }
  }

  updateAccessOrder(key) {
    this.accessOrder = this.accessOrder.filter(k => k !== key);
    this.accessOrder.push(key);
  }

  evictLRU() {
    const oldestKey = this.accessOrder.shift();
    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  isStale(key) {
    const entry = this.cache.get(key);
    if (!entry) return null;
    const now = Date.now();
    return now > entry.ttlExpiry && now <= entry.staleTtlExpiry;
  }

  clear() {
    this.cache.clear();
    this.accessOrder = [];
  }

  size() {
    return this.cache.size;
  }
}

export default SmartCache;
```

---

## ⏱️ TTL et SWR

### Formule: TTL vs Stale

```
TTL (Time To Live):
  - Entrée frais et valid
  - Servir immédiatement
  - Durée: généralement 5-10 min

Stale-While-Revalidate (SWR):
  - Entrée expiée mais "pas trop"
  - Servir au client immédiatement
  - Revalidate en BG (si demande suivante)
  - Durée: généralement 3x TTL

Total expiry:
  - Après SWR expiry, supprimer du cache
  - Prochain appel = fetch frais
```

### Exemple timeline

```
Instant 0:00    → Set key="mushrooms|place=123", TTL=5min, SWR=15min
              ├─ createdAt: 0:00
              ├─ ttlExpiry: 0:05
              └─ staleTtlExpiry: 0:15

Instant 0:03    → GET mushrooms|place=123
              ├─ now < ttlExpiry (fresh)
              ├─ Servir immédiatement
              └─ Mettre à jour LRU

Instant 0:07    → GET mushrooms|place=123
              ├─ now > ttlExpiry (stale)
              ├─ now < staleTtlExpiry (still in SWR window)
              ├─ Servir immédiatement (stale data)
              ├─ Lance revalidate en BG
              └─ Mettre à jour LRU

Instant 0:12 (BG)  → Revalidation complète
              ├─ Fetch frais de iNat
              ├─ Mettre à jour entry dans cache
              ├─ TTL reset: 0:12 + 5min = 0:17
              └─ SWR reset: 0:12 + 15min = 0:27

Instant 0:16    → GET mushrooms|place=123
              ├─ now < ttlExpiry (revalidated, fresh)
              ├─ Servir immédiatement
              └─ Mettre à jour LRU

Instant 0:28    → GET mushrooms|place=123
              ├─ now > staleTtlExpiry (complete expiry)
              ├─ Cache entry supprimée
              ├─ Fetch frais de iNat
              ├─ Stocker avec TTL/SWR frais
              └─ Servir
```

---

## 💾 Chaque cache expliqué

### 1. `questionCache` – Pool observations

**Rôle** : Mémoriser le pool d'observations iNat pour un set de paramètres (géo + période).

**TTL** : 5 minutes  
**SWR** : 15 minutes  
**Max entries** : 50

**Clé** : `geo=place_1234|month=10,11,12|version=1705340400000`

```javascript
const questionCache = new SmartCache(50);

// Exemple set
questionCache.set(
  'geo=place_7953|month=...',
  {
    byTaxon: { 52367: [obs1, obs2], 52368: [obs3, ...] },
    taxonList: [52367, 52368, ...],
    version: 1705340400000,
    obsCount: 523,
  },
  {
    ttl: 5 * 60 * 1000,       // 5 min
    staleTtl: 15 * 60 * 1000, // 15 min
  }
);
```

**Impact** :
- ✅ Évite requêtes iNat répétées (même paramètres)
- ✅ Performance : 0ms vs 500ms+ (fetch iNat)
- ❌ Limité à 50 pools (mémoire)
- ❌ TTL court : données peuvent devenir périmées

### 2. `selectionStateCache` – État client (deck, cooldown)

**Rôle** : Persister l'état de sélection par client (deck mélangé, cooldown, historique).

**TTL** : 10 minutes  
**SWR** : — (pas de revalidation)  
**Max entries** : 200

**Clé** : `geo=place_1234|month=...|clientIp=192.168.1.1`

```javascript
const selectionStateCache = new SmartCache(200);

selectionStateCache.set(
  `${cacheKey}|${clientIp}`,
  {
    taxonDeck: [shuffled taxon IDs],
    deckCursor: 5,
    recentTargetTaxa: new Set([52367, 52368]),
    recentObsSet: new Set([obs_id_1, obs_id_2, ...]),
    cooldownExpiry: null,
  },
  { ttl: 10 * 60 * 1000 }  // 10 min, pas de SWR
);
```

**Impact** :
- ✅ Anti-répétition sans persister DB
- ✅ Deck mélangé persiste across questions
- ❌ Perte si client change IP ou après 10 min inactivité
- ❌ Pas partagé entre instances (scaling)

### 3. `taxonDetailsCache` – Détails iNat (Wikipedia, common names)

**Rôle** : Mémoriser détails taxa (Wikipedia URL, common names par locale).

**TTL** : 24 heures  
**SWR** : 7 jours  
**Max entries** : 2000

**Clé** : `taxon:52367:fr` (taxon ID + locale)

```javascript
const taxonDetailsCache = new SmartCache(2000);

taxonDetailsCache.set(
  'taxon:52367:fr',
  {
    id: 52367,
    name: 'Amanita muscaria',
    preferred_common_name: 'Tue-mouche',
    wikipedia_url: 'https://fr.wikipedia.org/wiki/Amanita_muscaria',
    ancestors: [...],
  },
  {
    ttl: 24 * 60 * 60 * 1000,         // 24h
    staleTtl: 7 * 24 * 60 * 60 * 1000, // 7 days
  }
);
```

**Impact** :
- ✅ Très stable (détails taxa changent rarement)
- ✅ 2000 taxa = covering commune European mushrooms/trees
- ✅ TTL long = peu de fetch iNat
- ❌ SWR long : risque retarder mise à jour

### 4. `autocompleteCache` – Recherche taxa/places

**Rôle** : Mémoriser résultats autocomplétion (recherche `amanita`).

**TTL** : 10 minutes  
**SWR** : 1 heure  
**Max entries** : 50

**Clé** : `taxa:amanita:en` (query + locale)

```javascript
const autocompleteCache = new SmartCache(50);

autocompleteCache.set(
  'taxa:amanita:en',
  [
    { id: 52367, name: 'Amanita muscaria', common_name: 'Fly Agaric' },
    { id: 52362, name: 'Amanita', common_name: null },
    ...
  ],
  {
    ttl: 10 * 60 * 1000,       // 10 min
    staleTtl: 60 * 60 * 1000,  // 1h
  }
);
```

**Impact** :
- ✅ Autocomplete réactif
- ✅ Peu de requêtes iNat pour recherches common
- ❌ Nouveau taxa ajouté iNat = retard discovery

### 5. `questionQueueCache` – Prefetch questions (client-side)

**Rôle** : File d'attente de questions préchargées (une question d'avance).

**TTL** : 10 minutes  
**SWR** : — (descardée après use)  
**Max entries** : N/A (1 par client)

**Clé** : `queue:${sessionId}`

```javascript
// Côté client, après réponse utilisateur
const nextQuestion = await fetch(`/api/quiz-question?...`);
questionQueueCache.set(`queue:${sessionId}`, nextQuestion, { ttl: 10 * 60 * 1000 });

// Utilisateur fait la réponse
// → nextQuestion = cache.get(queue) → affichage immédiat
```

---

## 🔥 Circuit Breaker

### Pattern: Fail-fast + fallback

Si API iNat répétée failent, **arrêter d'essayer** et basculer sur packs locaux.

```javascript
const MAX_INATURALIST_FAILURES = 3;
let inaturalistFailureCount = 0;
let circuitBreakerOpen = false;

async function fetchWithCircuitBreaker(url, params) {
  // Vérifier circuit
  if (circuitBreakerOpen) {
    console.warn('Circuit breaker open → using local packs');
    return loadLocalPack(params.pack);
  }

  try {
    const result = await fetchJSON(url, params);
    
    // Reset on success
    inaturalistFailureCount = 0;
    circuitBreakerOpen = false;
    
    return result;
  } catch (error) {
    inaturalistFailureCount++;
    
    if (inaturalistFailureCount >= MAX_INATURALIST_FAILURES) {
      circuitBreakerOpen = true;
      console.error(`Circuit breaker open (${inaturalistFailureCount} failures)`);
      
      // Essayer fallback local
      try {
        return loadLocalPack(params.pack);
      } catch (localError) {
        throw new Error('Both iNat and local packs failed');
      }
    }
    
    throw error;
  }
}

/**
 * Reset circuit après recovery timeout
 */
setInterval(() => {
  if (circuitBreakerOpen && inaturalistFailureCount > 0) {
    inaturalistFailureCount--;
    console.log(`Circuit breaker recovery: ${MAX_INATURALIST_FAILURES - inaturalistFailureCount} more failures allowed`);
    
    if (inaturalistFailureCount === 0) {
      circuitBreakerOpen = false;
      console.log('Circuit breaker closed, attempting iNat again');
    }
  }
}, 30000);  // Check every 30 sec
```

---

## ⚠️ Limitations actuelles

### Problème 1: Pas de persistence

**Impact** : Cache perdu au redémarrage serveur.

**Solution** : Passer à Redis

```javascript
// Futur: Redis backend
const redis = new Redis();

class SmartCacheRedis extends SmartCache {
  async get(key) {
    const entry = await redis.get(key);
    if (!entry) return null;
    
    const parsed = JSON.parse(entry);
    if (Date.now() > parsed.staleTtlExpiry) {
      await redis.del(key);
      return null;
    }
    return parsed.value;
  }

  async set(key, value, options = {}) {
    const entry = {
      value,
      createdAt: Date.now(),
      ttlExpiry: Date.now() + options.ttl,
      staleTtlExpiry: Date.now() + options.staleTtl,
    };
    
    await redis.set(
      key,
      JSON.stringify(entry),
      'EX',
      Math.ceil(options.staleTtl / 1000)
    );
  }
}
```

### Problème 2: Pas de distribution (scaling horizontal)

**Impact** : Chaque instance a son propre cache → cache incoherence avec sticky sessions.

**Solution** : Sticky sessions OU Redis partagé

```javascript
// Sticky sessions (Express + HAProxy)
// Route tous requests d'un client vers même backend instance
// Voir DEPLOYMENT.md

// OU

// Redis partagé (meilleur)
// Toutes instances partagent même cache Redis
// Cohérence garantie
```

### Problème 3: TTL fixe

**Impact** :
- TTL trop court : bcp de fetch iNat
- TTL trop long : données périmées

**Solution** : TTL adaptatif

```javascript
/**
 * Adapter TTL basé sur usage
 */
function adaptiveTTL(key, accessCount) {
  if (accessCount < 2) {
    return 5 * 60 * 1000;   // 5 min (peu utilisé)
  } else if (accessCount < 10) {
    return 15 * 60 * 1000;  // 15 min (modéré)
  } else {
    return 30 * 60 * 1000;  // 30 min (très utilisé)
  }
}
```

### Problème 4: Anti-répétition naïf (50 obs)

**Impact** : Observation peut se répéter après 50 questions.

**Solution** : Augmenter ou utiliser bloom filter

```javascript
// Bloom filter (probabiliste, compact)
// Peut mémoriser millions d'observations avec peu de RAM
const BloomFilter = require('bloom-filters').BloomFilter;
const bf = BloomFilter.create(1000000, 4);  // 1M items, 4 hash functions

// Ajouter obs
bf.add(obsId);

// Vérifier (possibilité de false positives ~0.1%)
if (bf.has(obsId)) {
  // Probablement vu récemment
  // (false positives: rejette obs non vues, acceptable)
}
```

---

## 🚀 Solutions futures

### Phase 1: Redis backend (1-2 semaines)

- Persistence entre redémarrages
- Distribution multi-instance
- Compatible avec sticky sessions OU cache partagé

### Phase 2: Monitoring cache (1 semaine)

- Métriques: hit rate, miss rate, eviction rate
- Alertes si hit rate < 60%
- Dashboard Grafana

### Phase 3: TTL adaptatif (1-2 semaines)

- Analyser access patterns
- Auto-ajuster TTL par clé
- Optimiser hit rate

### Phase 4: Bloom filter anti-répétition (1 semaine)

- Remplacer Set 50-items par Bloom filter
- Mémoriser millions d'observations
- Réduire false positives

---

## 📊 Benchmarks

### Memory footprint

```
questionCache (50 entries × 100 KB avg)     = 5 MB
selectionStateCache (200 entries × 2 KB)    = 0.4 MB
taxonDetailsCache (2000 entries × 1 KB)     = 2 MB
autocompleteCache (50 entries × 5 KB)       = 0.25 MB
─────────────────────────────────────────────────
Total                                        ≈ 7.65 MB
```

### Hit rates (esperado)

- `questionCache` : 60-80% (users hit common packs/places)
- `selectionStateCache` : 90%+ (session affinity)
- `taxonDetailsCache` : 95%+ (stable taxa)
- `autocompleteCache` : 70-80% (common searches)

### Fetch iNat reduction

```
Sans cache : 100 req/min × 30s fetch = 50 req iNat/min
Avec cache : 100 req/min × 50% hit = 50 req/min
            50 miss × 30s fetch = 25 req iNat/min
─────────────────────────────────────────────────
Réduction : 50% fewer iNat calls
```

---

## 🔗 Ressources

- [ARCHITECTURE.md](../ARCHITECTURE.md) – Vue d'ensemble
- [QUIZ_PIPELINE.md](./QUIZ_PIPELINE.md) – Pipeline algorithmes
- [DEPLOYMENT.md](../ops/DEPLOYMENT.md) – Scaling, sticky sessions
