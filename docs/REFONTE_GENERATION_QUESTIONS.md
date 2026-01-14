# Refonte de la génération de questions - Inaturamouche

## Résumé des changements

Cette refonte optimise la génération de questions pour garantir :
- **Rapidité** : <500ms ressenti grâce au prefetch client et à la queue serveur
- **Pertinence** : Plus de fallback hors-sujet, erreurs explicites si pool vide
- **Qualité** : Leurres hybrides (API similar_species + phylogénie locale)

---

## 1. Leurres Hybrides Optimisés (`server.js`)

### Nouvelle fonction `fetchSimilarSpeciesWithTimeout`

```javascript
// Timeout strict: 900ms
// Cache agressif: 7 jours (fresh) + 30 jours (stale)
// Fallback silencieux: retourne [] en cas d'erreur
```

**Logique** :
1. Vérifier le cache (TTL 7j fresh, 30j stale)
2. Si cache miss : appel API avec `Promise.race` (timeout 900ms)
3. Si succès : cacher le résultat et retourner
4. Si timeout/erreur : retourner `[]` silencieusement

### Fonction `buildLures` refactorisée

**Stratégie hybride** :
- **Tentative API** : Appeler `fetchSimilarSpeciesWithTimeout(targetId, 900)`
- **Si API répond** :
  - Utiliser les espèces similaires de l'API comme leurres principaux
  - Compléter les slots restants avec des espèces phylogénétiquement proches (bucket `near`)
  - Source: `'api-hybrid'`
- **Si API timeout/échoue** :
  - Générer les 3 leurres via la logique LCA uniquement (near/mid/far)
  - Source: `'lca-only'`

**Résultat** : 
```javascript
{
  lures: [...],
  buckets: { near, mid, far },
  source: 'api-hybrid' | 'lca-only'
}
```

---

## 2. Suppression du Fallback Hors-Sujet (`server.js`)

### Changements

#### Imports supprimés
```javascript
// ❌ SUPPRIMÉ
import fallbackMushrooms from "./shared/data/common_european_mushrooms.json";
import fallbackTrees from "./shared/data/common_european_trees.json";
```

#### Fonctions supprimées
- `buildFallbackPool()` - Générait un pool de secours avec les packs locaux
- `FALLBACK_PACKS` - Constante mappant les packs de secours
- `FALLBACK_PLACEHOLDER_IMAGE` - Image SVG pour les packs offline

#### Fonction `getObservationPool` - Mode strict

**Avant** :
```javascript
catch (err) {
  // Fallback vers packs locaux
  const fallback = buildFallbackPool(fallbackContext);
  return { ...fallback, cacheStatus: "fallback" };
}
```

**Après** :
```javascript
catch (err) {
  // MODE STRICT : Plus de fallback
  const poolErr = new Error("Pool d'observations indisponible pour ces critères...");
  poolErr.status = err?.status || 503;
  poolErr.code = "POOL_UNAVAILABLE";
  throw poolErr;
}
```

### Résultat

Quand l'API iNaturalist ne retourne aucune observation pour les critères demandés :
- **HTTP 404/503** avec code `POOL_UNAVAILABLE`
- Message clair : "Aucune observation trouvée pour ces critères. Veuillez élargir la zone géographique, la période, ou réessayer plus tard."
- **Jamais** de contenu hors-sujet (champignons/arbres européens par défaut)

---

## 3. Architecture de Queue & Prefetch

### Côté Serveur (`server.js`)

#### File proactive déjà en place

```javascript
const queueEntry = getQueueEntry(queueKey);
let item = queueEntry.queue.shift(); // Dépiler

if (!item) {
  item = await buildQuizQuestion(context); // Génération synchrone si vide
}

res.json(item.payload); // Servir la réponse

// ✅ PROACTIF : Remplir la queue immédiatement après avoir servi
fillQuestionQueue(queueEntry, context).catch((err) => {
  req.log?.warn({ err }, "Background queue fill failed");
});
```

**Garantie** : Dès qu'une question est servie (shift), la suivante est lancée en construction immédiatement.

#### Fonction `fillQuestionQueue`

```javascript
async function fillQuestionQueue(entry, context) {
  if (entry.inFlight) return entry.inFlight; // Éviter les doublons
  
  entry.inFlight = (async () => {
    while (entry.queue.length < QUESTION_QUEUE_SIZE) {
      try {
        const item = await buildQuizQuestion(context);
        if (item?.payload) {
          entry.queue.push(item);
        } else {
          break;
        }
      } catch (err) {
        entry.lastFailureAt = Date.now();
        break;
      }
    }
  })().finally(() => {
    entry.inFlight = null;
  });
  
  return entry.inFlight;
}
```

**Taille de queue** : `QUESTION_QUEUE_SIZE = 3`

---

### Côté Client - Hook React `useQuestionQueue`

Nouveau fichier : `client/src/hooks/useQuestionQueue.js`

#### Usage simple

```jsx
import { useQuestionQueue } from '../hooks/useQuestionQueue';

function QuizGame() {
  const filters = { taxon_ids: '47126', place_id: '7044' };
  const { currentQuestion, dequeue, prefetchNext, isLoading } = useQuestionQueue(filters);

  useEffect(() => {
    // ✅ Dès que la question N est affichée, précharger N+1
    if (currentQuestion) {
      prefetchNext();
    }
  }, [currentQuestion, prefetchNext]);

  const handleNextQuestion = () => {
    dequeue(); // Dépiler → déclenche automatiquement le refill
  };

  return (
    <div>
      {currentQuestion && <QuestionCard data={currentQuestion} />}
      <button onClick={handleNextQuestion} disabled={isLoading}>
        Suivante
      </button>
    </div>
  );
}
```

#### Options

```javascript
const {
  currentQuestion,    // Question courante
  nextQuestion,       // Question suivante (préchargée)
  queueLength,        // Nombre de questions en file
  isLoading,          // Chargement en cours
  error,              // Erreur éventuelle
  dequeue,            // Dépiler la question courante
  prefetchNext,       // Précharger la suivante
  fillQueue,          // Remplir la file
  clear,              // Vider la file
  reset,              // Reset complet
} = useQuestionQueue(filters, {
  autoRefill: true,   // Refill automatique après dequeue
  queueSize: 2,       // Taille de la file
});
```

#### Version simplifiée `useQuizQuestion`

Pour un usage basique (une question à la fois) :

```jsx
import { useQuizQuestion } from '../hooks/useQuestionQueue';

function SimpleQuiz() {
  const { question, loadNext, isLoading, error } = useQuizQuestion(filters);

  return (
    <div>
      {question && <QuestionCard data={question} />}
      <button onClick={loadNext} disabled={isLoading}>
        Suivante
      </button>
    </div>
  );
}
```

---

## 4. Frontend - Timeouts & Erreurs (`client/src/services/api.js`)

### Timeout augmenté

```javascript
// Avant
const DEFAULT_TIMEOUT = 8000; // 8s

// Après
const DEFAULT_TIMEOUT = 15000; // 15s (absorber les cold starts iNaturalist)
```

### Messages d'erreur enrichis

Fichiers : `client/src/locales/{fr,en,nl}.js`

#### Français
```javascript
pool_unavailable: 'Aucune observation trouvée pour ces critères. Veuillez élargir la zone géographique, la période, ou réessayer plus tard.'
```

#### English
```javascript
pool_unavailable: 'No observations found for these criteria. Please broaden the geographic area, time period, or try again later.'
```

#### Nederlands
```javascript
pool_unavailable: 'Geen waarnemingen gevonden voor deze criteria. Verbreed het geografisch gebied, de periode, of probeer later opnieuw.'
```

---

## Performance attendue

### Latence ressentie

| Scénario | Avant | Après |
|----------|-------|-------|
| **Question N** (en cache serveur) | ~200ms | ~200ms |
| **Question N** (miss cache) | 2-5s | 2-5s |
| **Question N+1** (sans prefetch) | 2-5s | **~0ms** ✅ |
| **Question N+1** (avec prefetch) | 2-5s | **~0ms** ✅ |

### Cache similar_species

- **Fresh TTL** : 7 jours (604 800 000 ms)
- **Stale TTL** : 30 jours (2 592 000 000 ms)
- **Max entries** : 1000

**Résultat** : Les ressemblances entre espèces ne changent jamais → cache quasi-permanent.

---

## Migration / Checklist

### Backend
- [x] Ajouter `similarSpeciesCache` avec TTL long
- [x] Créer `fetchSimilarSpeciesWithTimeout(taxonId, 900)`
- [x] Refactoriser `buildLures` avec stratégie hybride
- [x] Supprimer imports `fallbackMushrooms` et `fallbackTrees`
- [x] Supprimer `buildFallbackPool()`, `FALLBACK_PACKS`, etc.
- [x] Mode strict dans `getObservationPool` (erreur 404/503, pas de fallback)
- [x] Retirer `fallbackContext` des signatures de fonctions

### Frontend
- [x] Augmenter `DEFAULT_TIMEOUT` à 15000ms
- [x] Enrichir messages d'erreur `pool_unavailable` (fr/en/nl)
- [x] Créer hook `useQuestionQueue` pour prefetch client
- [x] Créer hook `useQuizQuestion` (version simple)

### Tests
- [ ] Vérifier que `fetchSimilarSpeciesWithTimeout` retourne `[]` en cas de timeout
- [ ] Vérifier que `buildLures` fonctionne avec `source: 'api-hybrid'` et `source: 'lca-only'`
- [ ] Vérifier que le serveur retourne 503 + `POOL_UNAVAILABLE` si pool vide
- [ ] Tester le prefetch client (question N+1 chargée dès affichage de N)

---

## Exemples d'intégration

### Dans `PlayPage.jsx` (exemple)

```jsx
import { useQuestionQueue } from '../hooks/useQuestionQueue';

function PlayPage() {
  const filters = useFilters(); // { taxon_ids, place_id, d1, d2, ... }
  const { currentQuestion, dequeue, prefetchNext, isLoading, error } = useQuestionQueue(filters);

  // Prefetch dès que la question est affichée
  useEffect(() => {
    if (currentQuestion) {
      prefetchNext();
    }
  }, [currentQuestion, prefetchNext]);

  const handleAnswer = (answerId) => {
    // Logique de validation
    checkAnswer(answerId);
    
    // Passer à la suivante
    dequeue();
  };

  if (error) {
    return <ErrorModal error={error} />;
  }

  return (
    <div>
      {currentQuestion && (
        <QuestionCard
          data={currentQuestion}
          onAnswer={handleAnswer}
        />
      )}
      {isLoading && <Spinner />}
    </div>
  );
}
```

---

## Notes techniques

### Timeout `similar_species`

- **Valeur choisie** : 900ms (compromise entre latence et couverture)
- **Fallback silencieux** : Aucun log d'erreur côté utilisateur
- **Cache hit** : ~0ms (quasi-instantané)

### Queue serveur

- **Taille** : 3 questions (`QUESTION_QUEUE_SIZE`)
- **Remplissage** : Proactif après chaque shift
- **État** : `{ queue: [], inFlight: Promise|null, lastFailureAt: timestamp }`

### Hook React

- **AbortController** : Annule les requêtes en cours si les filtres changent
- **Auto-refill** : `autoRefill: true` par défaut
- **Queue size** : 2 par défaut (question courante + 1 préchargée)

---

## Dépannage

### "Pool unavailable" fréquents

**Causes** :
- Critères trop restrictifs (zone géographique petite + période courte)
- API iNaturalist lente/indisponible
- Cache serveur expiré

**Solutions** :
- Augmenter `QUESTION_CACHE_TTL` (actuellement 5 min)
- Élargir `DISTINCT_TAXA_TARGET` (actuellement 30)
- Augmenter `MAX_OBS_PAGES` (actuellement 1)

### Leurres de mauvaise qualité

**Causes** :
- API `similar_species` timeout systématiquement
- Pool local trop petit (< 10 taxons)

**Solutions** :
- Vérifier les logs `source: 'api-hybrid'` vs `'lca-only'`
- Augmenter le timeout `similar_species` (900ms → 1200ms)
- Vérifier le taux de hit du cache `similarSpeciesCache`

### Latence élevée malgré prefetch

**Causes** :
- Hook `useQuestionQueue` non utilisé côté client
- `prefetchNext()` non appelé après affichage de la question
- Queue serveur vide (cold start)

**Solutions** :
- Vérifier que `prefetchNext()` est bien appelé dans `useEffect`
- Augmenter `QUESTION_QUEUE_SIZE` (3 → 5)
- Monitorer `queueLength` dans le hook

---

## Métrics à surveiller

### Serveur
- Taux de hit du cache `similarSpeciesCache` (devrait être >80% après warmup)
- Latence `buildLures` (devrait être <1s avec cache hit)
- Ratio `source: 'api-hybrid'` vs `'lca-only'` (idéal >70% api-hybrid)
- Taux d'erreur `POOL_UNAVAILABLE` (devrait être <5%)

### Client
- Temps entre affichage question N et disponibilité question N+1 (devrait être ~0ms)
- Taux d'utilisation du hook `useQuestionQueue` vs appels API directs
- Nombre moyen de questions en file (`queueLength`)

---

## Conclusion

Cette refonte garantit :
- ✅ **Rapidité** : Prefetch client + queue serveur → latence ressentie <500ms
- ✅ **Pertinence** : Mode strict, pas de fallback hors-sujet
- ✅ **Qualité** : Leurres hybrides (API + phylogénie)

**Impact utilisateur** :
- Transition instantanée entre questions
- Messages d'erreur clairs et actionnables
- Leurres plus pertinents (espèces visuellement confondables)
