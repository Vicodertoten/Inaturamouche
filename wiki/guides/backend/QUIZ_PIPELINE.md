# Quiz Pipeline Deep Dive

Guide détaillé du pipeline `/api/quiz-question`, avec focus sur LCA, anti-répétition et algorithmes.

## 📋 Table des matières

1. [Aperçu global](#aperçu-global)
2. [Validation & normalisation](#validation--normalisation)
3. [Fetch observations iNat](#fetch-observations-inat)
4. [Indexation & sanitize](#indexation--sanitize)
5. [Sélection taxon (LCA)](#sélection-taxon-lca)
6. [Sélection observation](#sélection-observation)
7. [Génération leurres](#génération-leurres)
8. [Enrichissement taxonomique](#enrichissement-taxonomique)
9. [Construction réponse](#construction-réponse)

---

## 🎯 Aperçu global

Le pipeline transforme une requête utilisateur en **une question unique, scientifiquement crédible**.

```
Requête utilisateur
    ↓
[1] Validation (Zod)
    ↓
[2] Normalisation (géo, période)
    ↓
[3] Cache lookup
    ↓
[4] Fetch iNat (si cache miss)
    ↓
[5] Index par taxon
    ↓
[6] Récupérer état client (deck, cooldown)
    ↓
[7] Sélectionner taxon cible (LCA)
    ↓
[8] Sélectionner observation
    ↓
[9] Générer leurres (LCA bucketing)
    ↓
[10] Enrichir taxa (Wikipedia, common names)
    ↓
[11] Construire choix & réponse
    ↓
Réponse question (+ headers debug)
```

---

## 1️⃣ Validation & normalisation

### Validation Zod

```javascript
// server.js
const quizSchema = z.object({
  pack: z.string().optional(),
  taxon_ids: z.array(z.coerce.number()).optional(),
  place_id: z.coerce.number().optional(),
  bbox: z.string().optional(),
  taxon_month_window: z.string().optional(),
  locale: z.enum(['en', 'fr', 'nl']).default('en'),
  lure_count: z.coerce.number().int().min(2).max(10).default(4),
});

// Validation
const params = quizSchema.parse(req.query);
// → Lance ZodError si validation échoue
```

### Normalisation géographique

```javascript
/**
 * Détermine le mode géo (place, bbox ou global)
 */
function normalizeGeoParams(place_id, bbox, pack) {
  if (place_id) {
    return { mode: 'place_id', place_id, pack };
  }
  if (bbox) {
    const [minLon, minLat, maxLon, maxLat] = bbox.split(',').map(Number);
    if (!validBbox(minLon, minLat, maxLon, maxLat)) {
      throw new Error('Invalid bbox');
    }
    return { mode: 'bbox', bbox: { minLon, minLat, maxLon, maxLat }, pack };
  }
  return { mode: 'global', pack };
}
```

### Normalisation période (fenêtre saisonnière)

```javascript
/**
 * Convertit "MM-MM" (ex: "10-03") en array de mois
 * Support: 10-03 = Oct→Mar (chevauche année), 05-08 = mai→août
 */
function buildMonthDayFilter(taxon_month_window) {
  if (!taxon_month_window) return null;

  const [startMonth, endMonth] = taxon_month_window.split('-').map(Number);
  
  if (startMonth <= endMonth) {
    // Cas simple : mai-août
    return { months: Array.from({ length: endMonth - startMonth + 1 }, (_, i) => startMonth + i) };
  } else {
    // Cas chevauche : oct-mar
    const oct_to_dec = Array.from({ length: 12 - startMonth + 1 }, (_, i) => startMonth + i);
    const jan_to_mar = Array.from({ length: endMonth + 1 }, (_, i) => 1 + i);
    return { months: [...oct_to_dec, ...jan_to_mar] };
  }
}

// Exemple
buildMonthDayFilter('10-03');  // → { months: [10, 11, 12, 1, 2, 3] }
buildMonthDayFilter('05-08');  // → { months: [5, 6, 7, 8] }
```

---

## 2️⃣ Fetch observations iNat

### Stratégie pagination

```javascript
/**
 * Charge observations depuis iNat avec pagination
 * Arrête dès que DISTINCT_TAXA_TARGET atteint
 */
async function fetchObservationsChunked(params, options = {}) {
  const {
    maxPages = 10,
    pageSize = 80,
    targetDistinctTaxa = 100,
  } = options;

  const allObservations = [];
  const seenTaxa = new Set();

  for (let page = 1; page <= maxPages; page++) {
    const observations = await fetchJSON('https://api.inaturalist.org/v1/observations', {
      ...params,
      page,
      per_page: pageSize,
    });

    allObservations.push(...observations);

    // Compter taxa distincts
    observations.forEach(obs => {
      if (obs.taxon?.id) seenTaxa.add(obs.taxon.id);
    });

    console.log(`Page ${page}: ${seenTaxa.size} taxa distincts`);

    // Arrêter si objectif atteint
    if (seenTaxa.size >= targetDistinctTaxa) {
      console.log(`Stopping at page ${page} (${seenTaxa.size} taxa ≥ ${targetDistinctTaxa})`);
      break;
    }
  }

  return allObservations;
}
```

### Retries et timeout

```javascript
/**
 * Fetch avec retries exponentiel + timeout
 */
async function fetchJSON(url, params = {}, options = {}) {
  const {
    timeoutMs = 30000,
    retries = 3,
    logger = console,
    requestId = 'unknown',
    label = 'fetch',
  } = options;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(`${url}?${new URLSearchParams(params)}`, {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      const backoffMs = Math.pow(2, attempt - 1) * 100;  // 100ms, 200ms, 400ms

      if (attempt === retries) {
        logger.error(`[${requestId}] ${label} failed after ${retries} attempts`, { error });
        throw error;
      }

      logger.warn(`[${requestId}] ${label} attempt ${attempt} failed, retrying in ${backoffMs}ms`, { error });
      await new Promise(resolve => setTimeout(resolve, backoffMs));
    }
  }
}
```

---

## 3️⃣ Indexation & sanitize

### Sanitize observation

```javascript
/**
 * Garder seulement observations avec :
 * - Photos
 * - Taxon avec ancêtres (pour LCA)
 */
function sanitizeObservation(obs) {
  // Filtrer: pas de photos
  if (!obs.photos || obs.photos.length === 0) {
    return null;
  }

  // Filtrer: pas de taxon
  if (!obs.taxon) {
    return null;
  }

  // Filtrer: pas d'ancêtres (impossible de calculer LCA)
  const ancestors = obs.taxon.ancestors || [];
  if (ancestors.length === 0) {
    return null;
  }

  return {
    id: obs.id,
    taxonId: obs.taxon.id,
    taxonName: obs.taxon.name,
    photos: obs.photos.map(p => ({
      url: p.url,
      license: p.license_code || 'unknown',
      photographer: p.attribution || 'unknown',
    })),
    // Autres metadata: user, location, created_at, etc.
  };
}
```

### Index par taxon

```javascript
/**
 * Crée structure : { byTaxon: {taxonId: [obs, obs, ...]}, taxonList: [ids] }
 */
function buildTaxonIndex(sanitizedObservations) {
  const byTaxon = {};
  const taxonSet = new Set();

  sanitizedObservations.forEach(obs => {
    if (!byTaxon[obs.taxonId]) {
      byTaxon[obs.taxonId] = [];
    }
    byTaxon[obs.taxonId].push(obs);
    taxonSet.add(obs.taxonId);
  });

  const taxonList = Array.from(taxonSet);

  return {
    byTaxon,
    taxonList,
    version: Date.now(),
    obsCount: sanitizedObservations.length,
  };
}

// Exemple structure
// {
//   byTaxon: {
//     52367: [obs1, obs2, obs3],      // Amanita muscaria
//     52368: [obs4, obs5],             // Amanita virosa
//   },
//   taxonList: [52367, 52368],
//   version: 1705340400000,
//   obsCount: 5
// }
```

---

## 4️⃣ Sélection taxon (LCA)

### Deck mélangé et sans remise

```javascript
/**
 * Choisir prochain taxon éligible
 * Critères :
 * - Pas de doublon (cooldown cible)
 * - Pas de bloc (cooldown)
 * - Au moins 1 obs disponible
 */
function nextEligibleTaxonId(pool, selectionState, now, excludeSet = new Set()) {
  const { taxonDeck, deckCursor, recentTargetTaxa, cooldownExpiry } = selectionState;

  // Vérifier cooldown global (si TTL activé)
  if (cooldownExpiry && now < cooldownExpiry) {
    console.warn('Global cooldown active, using relaxed selection');
    return pickRelaxedTaxon(pool, excludeSet);
  }

  // Parcourir deck
  for (let i = deckCursor; i < taxonDeck.length; i++) {
    const taxonId = taxonDeck[i];

    // Skip: dans exclude set
    if (excludeSet.has(taxonId)) continue;

    // Skip: trop récent (cooldown cible)
    if (recentTargetTaxa.has(taxonId)) continue;

    // Skip: aucune obs dispo pour ce taxon
    if (!pool.byTaxon[taxonId] || pool.byTaxon[taxonId].length === 0) continue;

    // ✅ Taxon éligible trouvé
    // Mettre à jour cursor
    selectionState.deckCursor = i + 1;

    // Ajouter à recent (FIFO, max 10)
    recentTargetTaxa.add(taxonId);
    if (recentTargetTaxa.size > 10) {
      const oldest = recentTargetTaxa.values().next().value;
      recentTargetTaxa.delete(oldest);
    }

    return taxonId;
  }

  // ❌ Deck épuisé
  console.warn('Taxon deck exhausted, falling back to relaxed selection');
  return pickRelaxedTaxon(pool, excludeSet);
}
```

### Fallback relaxed (si deck épuisé)

```javascript
/**
 * Fallback : sélection pondérée basée sur nb obs
 * Taxa avec plus d'obs = plus de chance
 */
function pickRelaxedTaxon(pool, excludeSet = new Set()) {
  // Construire weights: nb obs par taxon
  const weights = pool.taxonList
    .filter(id => !excludeSet.has(id))
    .map(id => ({
      taxonId: id,
      weight: pool.byTaxon[id].length,
    }));

  if (weights.length === 0) {
    throw new Error('No taxa available for relaxed selection');
  }

  // Sélection pondérée (roulette)
  const totalWeight = weights.reduce((sum, w) => sum + w.weight, 0);
  let pick = Math.random() * totalWeight;

  for (const { taxonId, weight } of weights) {
    pick -= weight;
    if (pick <= 0) {
      return taxonId;
    }
  }

  // Fallback ultime (ne devrait jamais arriver ici)
  return weights[0].taxonId;
}
```

---

## 5️⃣ Sélection observation

### Privilégier observations jamais servies

```javascript
/**
 * Choisir observation pour taxon cible
 * Priorité : jamais servi > jamais vu > n'importe
 */
function pickObservationForTaxon(pool, targetTaxonId, selectionState) {
  const obs = pool.byTaxon[targetTaxonId];
  if (!obs || obs.length === 0) {
    throw new Error(`No observations for taxon ${targetTaxonId}`);
  }

  const { recentObsSet } = selectionState;

  // Priorité 1 : obs jamais servies
  const unserved = obs.filter(o => !recentObsSet.has(o.id));
  if (unserved.length > 0) {
    const chosen = unserved[Math.floor(Math.random() * unserved.length)];
    rememberObservation(selectionState, chosen.id);
    return chosen;
  }

  // Priorité 2 : si tout a été servi, piocher random
  console.warn(`All observations for taxon ${targetTaxonId} have been served, reusing`);
  const chosen = obs[Math.floor(Math.random() * obs.length)];
  rememberObservation(selectionState, chosen.id);
  return chosen;
}

/**
 * Mémoriser observation servie (FIFO 50)
 */
function rememberObservation(selectionState, obsId) {
  selectionState.recentObsSet.add(obsId);
  if (selectionState.recentObsSet.size > 50) {
    const oldest = selectionState.recentObsSet.values().next().value;
    selectionState.recentObsSet.delete(oldest);
  }
}
```

---

## 6️⃣ Génération leurres

### LCA et distance taxonomique

```javascript
/**
 * Calculer profondeur LCA (proximity score)
 * Plus proche = 1.0, très loin = 0.0
 *
 * Formule : (profondeur LCA) / (profondeur target)
 * Exemple :
 *   - Amanita muscaria → Amanita virosa (même genre)
 *     LCA = Amanita (profondeur 5), target = 6 → score = 5/6 = 0.83 (near)
 *   - Amanita muscaria → Boletus edulis (genres différents)
 *     LCA = Basidiomycota (profondeur 3), target = 6 → score = 3/6 = 0.50 (far)
 */
function calculateLCAProximity(targetAncestors, lureAncestors) {
  // Construire set des ancêtres target
  const targetAncestorIds = new Set(targetAncestors.map(a => a.id));
  targetAncestorIds.add(targetAncestors[targetAncestors.length - 1].id);  // Inclure le taxon lui-même

  // Trouver LCA profondeur (le plus proche dans la hiérarchie)
  let lcaProfondeur = 0;
  for (const ancestor of lureAncestors) {
    if (targetAncestorIds.has(ancestor.id)) {
      lcaProfondeur = ancestor.depth || lureAncestors.indexOf(ancestor);
      break;
    }
  }

  // Normaliser par profondeur target
  const targetDepth = targetAncestors.length || 1;
  return lcaProfondeur / targetDepth;
}
```

### Bucketing LCA

```javascript
/**
 * Classer leurres en buckets selon proximité LCA
 */
function buildLures(pool, selectionState, targetTaxonId, targetObservation, lureCount = 4) {
  const targetTaxonDetails = pool.byTaxon[targetTaxonId][0];  // Au minimum, une obs
  if (!targetTaxonDetails) {
    throw new Error(`No target observation for taxon ${targetTaxonId}`);
  }

  // Classer toutes taxa en buckets (sauf target)
  const buckets = {
    near: [],   // ≥ 0.85
    mid: [],    // ≥ 0.65
    far: [],    // < 0.65
  };

  const excludeSet = new Set([targetTaxonId]);

  for (const lureTaxonId of pool.taxonList) {
    if (excludeSet.has(lureTaxonId)) continue;
    if (!pool.byTaxon[lureTaxonId] || pool.byTaxon[lureTaxonId].length === 0) continue;

    // Calculer proximité LCA
    const proximity = calculateLCAProximity(
      targetTaxonDetails.ancestors,
      pool.byTaxon[lureTaxonId][0].ancestors
    );

    if (proximity >= 0.85) {
      buckets.near.push({ taxonId: lureTaxonId, proximity });
    } else if (proximity >= 0.65) {
      buckets.mid.push({ taxonId: lureTaxonId, proximity });
    } else {
      buckets.far.push({ taxonId: lureTaxonId, proximity });
    }
  }

  // Sélectionner leurres : min 1 par bucket disponible
  const selectedLures = [];
  const bucketsUsed = { near: 0, mid: 0, far: 0 };

  for (const bucketName of ['near', 'mid', 'far']) {
    const bucket = buckets[bucketName];
    if (bucket.length > 0 && selectedLures.length < lureCount) {
      // Prendre 1 aléatoire du bucket
      const randomIdx = Math.floor(Math.random() * bucket.length);
      const { taxonId } = bucket[randomIdx];
      
      const obs = pool.byTaxon[taxonId][Math.floor(Math.random() * pool.byTaxon[taxonId].length)];
      selectedLures.push({ taxonId, obs });
      bucketsUsed[bucketName]++;
      excludeSet.add(taxonId);
    }
  }

  // Remplir reste aléatoirement (sauf duplicates)
  while (selectedLures.length < lureCount) {
    const available = pool.taxonList.filter(id => !excludeSet.has(id) && pool.byTaxon[id].length > 0);
    if (available.length === 0) break;

    const taxonId = available[Math.floor(Math.random() * available.length)];
    const obs = pool.byTaxon[taxonId][Math.floor(Math.random() * pool.byTaxon[taxonId].length)];
    selectedLures.push({ taxonId, obs });
    excludeSet.add(taxonId);
  }

  return {
    lures: selectedLures,
    buckets: bucketsUsed,
  };
}
```

---

## 7️⃣ Enrichissement taxonomique

### Récupérer détails iNat

```javascript
/**
 * Fetch details pour tous taxa (avec fallback locale)
 */
async function getFullTaxaDetails(taxonIds, locale = 'en') {
  const details = {};

  for (const taxonId of taxonIds) {
    try {
      // Tenter locale demandée
      let taxon = await fetchJSON('https://api.inaturalist.org/v1/taxa', {
        id: taxonId,
        locale,
      });

      if (taxon && taxon[0]) {
        details[taxonId] = taxon[0];
        continue;
      }

      // Fallback anglais
      taxon = await fetchJSON('https://api.inaturalist.org/v1/taxa', {
        id: taxonId,
        locale: 'en',
      });

      if (taxon && taxon[0]) {
        details[taxonId] = taxon[0];
      }
    } catch (error) {
      console.warn(`Failed to fetch details for taxon ${taxonId}`, error);
      // Continuer sans ce détail
    }
  }

  return details;
}
```

---

## 8️⃣ Construction réponse

### Labels uniques

```javascript
/**
 * Générer libellés uniques pour chaque choix
 */
function makeChoiceLabels(taxaDetails, locale) {
  const choices = [];

  for (const [taxonId, taxon] of Object.entries(taxaDetails)) {
    const label = `${taxon.preferred_common_name || taxon.name} (${taxon.name})`;
    choices.push({
      taxonId: parseInt(taxonId),
      label,
      difficulty: 'hard',  // Par défaut hard
    });
  }

  return choices;
}

/**
 * Mode facile : libellés simplifiés
 */
function deriveEasyMode(choices) {
  return choices.map(c => ({
    ...c,
    label: c.label.split('(')[0].trim(),  // Garder seulement common name
    difficulty: 'easy',
  }));
}
```

### Mélanger les choix

```javascript
/**
 * Fisher-Yates shuffle
 */
function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
```

---

## 📊 Exemple complet

```javascript
// Requête utilisateur
const params = {
  pack: 'common_european_mushrooms',
  place_id: 7953,  // France
  locale: 'fr',
  lure_count: 4,
};

// [1-3] Validation, normalisation, cache lookup
const geoParams = normalizeGeoParams(params.place_id);
const cacheKey = buildCacheKey(geoParams, null);
let pool = questionCache.get(cacheKey);

if (!pool) {
  // [4-5] Fetch + sanitize + index
  const obs = await fetchObservationsChunked({ place_id: 7953, ... });
  const sanitized = obs.map(sanitizeObservation).filter(Boolean);
  pool = buildTaxonIndex(sanitized);
  questionCache.set(cacheKey, pool, { ttl: 5 * 60 * 1000 });
}

// [6] État client
let selectionState = selectionStateCache.get(`${cacheKey}|${clientIp}`);
if (!selectionState) {
  selectionState = {
    taxonDeck: shuffle(pool.taxonList),
    deckCursor: 0,
    recentTargetTaxa: new Set(),
    recentObsSet: new Set(),
  };
}

// [7] Sélectionner taxon
const targetTaxonId = nextEligibleTaxonId(pool, selectionState, Date.now());

// [8] Sélectionner observation
const targetObs = pickObservationForTaxon(pool, targetTaxonId, selectionState);

// [9] Générer leurres
const { lures, buckets } = buildLures(pool, selectionState, targetTaxonId, targetObs, 4);

// [10] Enrichir
const allTaxonIds = [targetTaxonId, ...lures.map(l => l.taxonId)];
const taxaDetails = await getFullTaxaDetails(allTaxonIds, 'fr');

// [11] Construire réponse
const choices = makeChoiceLabels(taxaDetails, 'fr');
const mixedChoices = shuffle(choices);
const correctIndex = mixedChoices.findIndex(c => c.taxonId === targetTaxonId);

return {
  id: generateId(),
  images: targetObs.photos.map(p => ({ url: p.url, license: p.license, ... })),
  taxon: { id: targetTaxonId, name: taxaDetails[targetTaxonId].name, ... },
  choices: mixedChoices,
  easyChoices: deriveEasyMode(mixedChoices),
  correctIndex,
};
```

---

## 🔗 Ressources

- [ARCHITECTURE.md](../ARCHITECTURE.md) – Vue d'ensemble
- [CACHE_STRATEGY.md](./CACHE_STRATEGY.md) – SmartCache
- [OBSERVABILITY.md](./OBSERVABILITY.md) – Debug headers
