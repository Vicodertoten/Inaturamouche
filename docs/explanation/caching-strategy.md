# Strategie de cache

> Comment le serveur absorbe iNaturalist, les explications IA et les rounds actifs sans base de donnees.

## 1. Piece centrale: `SmartCache`

Fichier: `lib/smart-cache.js`

Le cache memoire interne fournit :

- TTL
- stale-while-revalidate
- request coalescing
- eviction LRU
- revalidation en arriere-plan

Constructeur :

```js
new SmartCache({
  max,
  ttl,
  staleTtl,
})
```

## 2. Comportement

### Fresh

- entree retournee immediatement
- aucun fetch externe

### Stale

- entree stale servie si autorisee
- revalidation en fond possible

### Expiree

- entree supprimee
- fetch obligatoire

## 3. Request coalescing

Si plusieurs requetes demandent la meme cle simultanement :

- une seule lance le fetch
- les autres reutilisent la meme promesse

Cela evite les stampedes sur iNaturalist ou sur les fetchs IA.

## 4. Eviction

`SmartCache` maintient un ordre LRU base sur la `Map` interne et deplace les entrees touchees en fin de structure.

## 5. Instances principales

| Instance | Localisation | Usage |
|----------|-------------|-------|
| `questionCache` | `server/cache/questionCache.js` | Pools d'observations |
| `autocompleteCache` | `server/cache/autocompleteCache.js` | Autocomplete taxons |
| `taxonDetailsCache` | `server/cache/taxonDetailsCache.js` | Details enrichis des taxons |
| `similarSpeciesCache` | `server/cache/similarSpeciesCache.js` | Especes similaires |
| `selectionStateCache` | `server/cache/selectionCache.js` | Etat de selection par client |
| `questionQueueCache` | `server/cache/selectionCache.js` | Pre-generation de questions |
| `roundCache` | `server/services/roundStore.js` | Rounds actifs |
| `submissionDedupCache` | `server/services/roundStore.js` | Anti double-submit |
| `briefExplanationCache` | `server/services/ai/aiPipeline.js` | Explications `brief` |
| `fullExplanationCache` | `server/services/ai/aiPipeline.js` | Explications `full` |
| `riddleCache` | `server/services/ai/aiPipeline.js` | Reliquat archive |
| `taxonEvidenceCache` | `server/services/ai/ragSources.js` | Bundles RAG par taxon |
| `taxonomySupportCache` | `server/services/ai/ragSources.js` | Support taxonomique RAG |

## 6. Politique generale

- iNaturalist: caches courts a moyens, avec stale
- taxons enrichis: caches longs
- rounds: caches courts et stricts
- IA: caches plus longs, avec cle basee sur le contexte du prompt

## 7. Degradation gracieuse

Le cache n'est pas seulement un accelerateur. Il sert aussi a la resilience :

1. servir du fresh
2. servir du stale
3. retenter un fetch
4. retomber sur un mode degrade si la source externe echoue

Cette logique est critique pour `quiz-question`, ou la latence et la disponibilite doivent rester acceptables meme en cas de tension externe.
