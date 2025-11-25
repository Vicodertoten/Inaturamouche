# Architecture Backend & Logique Métier

Ce document décrit la chaîne complète de génération d'une question de quiz, la stratégie de cache et les points d'observabilité exposés par l'API.

## Fonctions critiques (JSDoc)

Les fonctions sensibles sont maintenant documentées directement dans le code :

```js
// server.js
/**
 * Fetches JSON from iNaturalist avec retries + timeout.
 */
async function fetchJSON(url, params = {}, { timeoutMs, retries, logger, requestId, label } = {}) { ... }

/**
 * Sélection sans remise : deck mélangé + curseur.
 */
function nextEligibleTaxonId(pool, selectionState, now, excludeSet = new Set()) { ... }

/**
 * Leurres équilibrés via profondeur LCA (near/mid/far).
 */
function buildLures(pool, selectionState, targetTaxonId, targetObservation, lureCount = LURE_COUNT) { ... }

// lib/quiz-utils.js
/**
 * Cooldown effectif borné par la taille du pool.
 */
export function effectiveCooldownN(baseN, taxonListLen, quizChoices) { ... }
```

## Pipeline `/api/quiz-question`

1. **Validation d'entrée (Zod)** : `quizSchema` contrôle les paramètres (pack, filtres taxa, place/bbox, période, locale).  
2. **Normalisation géo/temps** : `geoParams` détermine le mode (`place_id`, bbox ou global). `buildMonthDayFilter` permet un filtre saisonnier à cheval sur deux années.  
3. **Clé de cache** : `buildCacheKey` (donnée + période normalisée) → lookup dans `questionCache` (LRU mémoire, TTL 5 min, max 50).  
4. **Constitution du pool** (si cache expiré/absent) : fetch iNat observations (80 par page, max `MAX_OBS_PAGES`), `sanitizeObservation` ne garde que les taxons avec photos et ancêtres. On arrête dès que `DISTINCT_TAXA_TARGET` est atteint. Indexation `byTaxon` + `taxonList`.  
5. **État de sélection par client** : `selectionStateCache` (TTL 10 min) est clé par `cacheKey|clientIp` et conserve un deck mélangé, un curseur, l'historique des cibles (`recentTargetTaxa`), un cooldown TTL optionnel et les observations récemment servies (anti-répétition).  
6. **Choix de la cible** : `nextEligibleTaxonId` pioche sans remise tant qu'un taxon reste éligible (observations disponibles, non bloqué par cooldown). Fallback pondéré `pickRelaxedTaxon` si tout est épuisé.  
7. **Observation cible** : `pickObservationForTaxon` privilégie une observation jamais servie (`recentObsSet`/`RECENT_OBS_MAX`). `rememberObservation` mémorise l'ID pour la suite.  
8. **Leurres** : `buildLures` calcule la proximité via LCA (profondeur partagée/ profondeur cible). Buckets :
   - `near` ≥ 0.85 (même genre/famille),
   - `mid` ≥ 0.65 (même ordre/classe),
   - `far` sinon (diversité assurée).  
   L'algorithme prend au moins 1 leurre par bucket disponible, puis remplit en respectant l'unicité et la disponibilité des observations. Résultat : `lures` + comptage `buckets` exposé dans les headers.  
9. **Enrichissement taxonomique** : `getFullTaxaDetails` requête iNat en locale + fallback anglais pour combler `wikipedia_url` ou `preferred_common_name`. Les détails manquants sont complétés via les observations.  
10. **Construction des choix** : `makeChoiceLabels` génère des libellés uniques (commun + scientifique). Les choix sont mélangés, l'index correct est identifié, et un mode « facile » dérive des mêmes IDs.  
11. **Réponse** : images (urls + métadonnées licences), taxon correct (nom, commun, ancêtres, wikipedia), choix riches et faciles, `inaturalist_url` pour la fiche.

## Stratégie de cache

- **SimpleLRUCache** (in-memory) :  
  - `questionCache` (TTL 5 min, max 50) stocke `byTaxon`, `taxonList`, `version` (timestamp).  
  - `autocompleteCache` (TTL 10 min, max 50) pour `/api/places` et `/api/taxa/autocomplete`.  
  - `selectionStateCache` (TTL 10 min, max 200) pour les decks par client (non partagé entre utilisateurs).  
- **Limites** : pas de persistance ni distribution multi-instance ; en cas de scaling horizontal, prévoir un store partagé (Redis) ou coller l'affinité client→instance. Les TTL courtes réduisent la dérive mais n'empêchent pas des doublons si plusieurs pods servent un même client.

## Observabilité & Debug

- `X-Cache-Key` : clé unique du pool (params + période).  
- `X-Selection-Geo` : `place_id`, `bbox` ou `global` selon la normalisation.  
- `X-Lure-Buckets` : répartition near|mid|far des leurres pour vérifier la diversité.  
- `X-Pool-Pages` / `X-Pool-Obs` / `X-Pool-Taxa` : volume de données iNat chargées pour la question courante.  
- `X-Lures-Relaxed` : indicateur d'un fallback de sélection.  
- `Server-Timing` + `X-Timing` (JSON) : temps par étape (`fetchObs`, `buildIndex`, `pickTarget`, `buildLures`, `taxa`, `labels`, `total`). Exploitable dans les DevTools pour localiser un goulot.

## Algorithmes anti-répétition

- **Cooldown cible** : `effectiveCooldownN` borne la profondeur mémoire (`COOLDOWN_TARGET_N`) en fonction du nombre de taxons disponibles (évite l'épuisement). Option TTL (`COOLDOWN_TARGET_MS`) désactivée par défaut.  
- **Sans remise observation** : `recentObsSet`/`recentObsQueue` limite la réutilisation d'une même observation (`RECENT_OBS_MAX`).  
- **Shuffle résilient** : le deck est re-mélangé dès qu'il est consommé, et le curseur ne s'incrémente que sur un taxon éligible.
