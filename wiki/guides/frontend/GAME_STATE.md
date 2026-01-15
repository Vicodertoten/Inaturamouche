# Game State Machine & Context API

Guide complet de `GameContext`, le cœur du moteur d'état du jeu.

## 📋 Table des matières

1. [GameContext architecture](#gameontext-architecture)
2. [États et transitions](#états-et-transitions)
3. [Hooks et abortController](#hooks-et-abortcontroller)
4. [Lifecycle d'une partie](#lifecycle-dune-partie)
5. [Erreurs et edge cases](#erreurs-et-edge-cases)

---

## 🎯 GameContext architecture

### Contexte centralisé

`client/src/context/GameContext.jsx` stocke tout l'état du jeu:

```javascript
import { createContext, useContext, useReducer } from 'react';

export const GameContext = createContext();

/**
 * Initial state
 */
const initialState = {
  // Flags
  isGameActive: false,
  isGameOver: false,
  gameMode: 'easy',  // 'easy' | 'hard'

  // Questions
  question: null,
  nextQuestion: null,
  questionCount: 1,
  maxQuestions: null,  // null = illimité

  // Scoring
  score: 0,
  streak: 0,
  maxStreak: 0,
  roundResults: [],

  // Review mode
  canStartReview: false,
  reviewTaxonIds: [],
  isReviewMode: false,

  // Errors
  error: null,

  // Config
  activeFilters: {},  // { pack, place_id, bbox, taxon_ids, ... }
};

/**
 * Action reducer
 */
function gameReducer(state, action) {
  switch (action.type) {
    case 'GAME_START':
      return {
        ...state,
        isGameActive: true,
        question: null,
        nextQuestion: null,
        questionCount: 1,
        score: 0,
        streak: 0,
        activeFilters: action.payload.filters,
      };

    case 'SET_QUESTION':
      return {
        ...state,
        question: action.payload,
      };

    case 'SET_NEXT_QUESTION':
      return {
        ...state,
        nextQuestion: action.payload,
      };

    case 'COMPLETE_ROUND':
      const { correct, timeMs, biomes } = action.payload;
      const newScore = state.score + (correct ? 10 : 0);
      const newStreak = correct ? state.streak + 1 : 0;
      return {
        ...state,
        score: newScore,
        streak: newStreak,
        maxStreak: Math.max(state.maxStreak, newStreak),
        questionCount: state.questionCount + 1,
        roundResults: [
          ...state.roundResults,
          { correct, timeMs, biomes, questionCount: state.questionCount },
        ],
      };

    case 'GAME_OVER':
      return {
        ...state,
        isGameActive: false,
        isGameOver: true,
        nextQuestion: null,
      };

    case 'RESET_TO_LOBBY':
      return initialState;

    case 'SET_ERROR':
      return {
        ...state,
        error: action.payload,
      };

    case 'SET_REVIEW_MODE':
      return {
        ...state,
        isReviewMode: true,
        reviewTaxonIds: action.payload.taxonIds,
      };

    default:
      return state;
  }
}

/**
 * Provider component
 */
export function GameProvider({ children }) {
  const [state, dispatch] = useReducer(gameReducer, initialState);

  return (
    <GameContext.Provider value={{ state, dispatch }}>
      {children}
    </GameContext.Provider>
  );
}

/**
 * Hook to use context
 */
export function useGame() {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGame must be used within GameProvider');
  }
  return context;
}
```

---

## 🎮 États et transitions

### State machine visuelle

```
┌─────────────────────────────────────────────────────────────┐
│                         LOBBY                               │
│  - Configurator (pack, filtres)                            │
│  - Stats précédentes affichées                             │
│  - Bouton "Commencer une partie"                           │
└────────────────┬────────────────────────────────────────────┘
                 │ startGame()
                 ↓
┌─────────────────────────────────────────────────────────────┐
│                        LOADING                              │
│  - Spinner affichée                                         │
│  - Fetch question principale (API)                         │
│  - Prefetch question suivante (background)                 │
│  - isGameActive = true                                     │
└────────────────┬────────────────────────────────────────────┘
                 │ question loaded
                 ↓
┌─────────────────────────────────────────────────────────────┐
│                       PLAYING                               │
│  - Afficher question (image + choix)                       │
│  - Mode: EasyMode ou HardMode                              │
│  - Chronomètre de réponse                                  │
│  - Écouter: utilisateur sélectionne réponse               │
└────────────┬───────────────────────────────────────────────┘
             │ completeRound()
             ↓
┌─────────────────────────────────────────────────────────────┐
│                       SUMMARY                               │
│  - Afficher recap manche                                    │
│  - Score, streak, réponse correcte                         │
│  - nextQuestion déjà préchargée                            │
│  - Bouton "Continuer"                                      │
└───┬─────────────────────────┬───────────────────────────────┘
    │                         │
    │ continuer               │ maxQuestions reached
    │ (question < max)        │
    │                         ↓
    └────────────┐    ┌─────────────────────────────────────┐
                 │    │       GAME_OVER (finalizeGame)      │
                 │    │  - isGameActive = false             │
                 │    │  - isGameOver = true                │
                 │    │  - EndScreen affichée               │
                 │    │  - Redirect /end                    │
                 │    └─────────────────────────────────────┘
                 │
                 └────────────→ PLAYING (avec nextQuestion)
                               repeater: SUMMARY → PLAYING
```

### Transitions détaillées

**LOBBY → LOADING → PLAYING → SUMMARY → PLAYING → ... → GAME_OVER → LOBBY**

```javascript
// Action: startGame
dispatch({
  type: 'GAME_START',
  payload: { filters: { pack: 'mushrooms', ... } }
});

// → isGameActive = true, question = null (LOADING state)
// → Effect: fetchQuestion()
// → → API call /api/quiz-question
// → → Une fois reçue: dispatch(SET_QUESTION)

// → question prêt (PLAYING state)
// → Afficher EasyMode ou HardMode

// Action: completeRound (une fois utilisateur a répondu)
dispatch({
  type: 'COMPLETE_ROUND',
  payload: { correct: true, timeMs: 8500, biomes: ['forest', 'meadow'] }
});

// → score +10, streak +1, questionCount +1 (SUMMARY state)
// → Afficher recap
// → nextQuestion est déjà prêt (préchargée)

// Utilisateur clique "Continuer"
// → question = nextQuestion
// → dispatch(SET_NEXT_QUESTION) = null (ou préchargé suivant)
// → Retour PLAYING (repeat)

// Après N questions OU utilisateur clique "Terminer"
dispatch({ type: 'GAME_OVER' });

// → isGameActive = false, isGameOver = true
// → Afficher EndScreen
// → Redirection /end

// Utilisateur clique "Rejouer" ou "Accueil"
dispatch({ type: 'RESET_TO_LOBBY' });

// → État = initialState
// → Redirect /home
```

---

## 🔄 Hooks et AbortController

### Préchargement questions (prefetch)

```javascript
/**
 * Prefetch question suivante en background
 * Réduit latency perceived
 */
function usePrefetchQuestion() {
  const { state, dispatch } = useGame();

  const prefetch = useCallback(async (filters) => {
    try {
      const response = await fetch('/api/quiz-question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(filters),
        signal: prefetchAbortController.signal,  // Can be cancelled
      });

      if (!response.ok) throw new Error(response.statusText);

      const nextQuestion = await response.json();

      dispatch({
        type: 'SET_NEXT_QUESTION',
        payload: nextQuestion,
      });
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Prefetch failed:', error);
        // Pas de dispatch error, prefetch failure = graceful degrade
      }
    }
  }, [dispatch]);

  return prefetch;
}

/**
 * Annulation intelligente de requêtes
 */
const [abortController, setAbortController] = useState(new AbortController());
const [prefetchAbortController, setPrefetchAbortController] = useState(new AbortController());

// Si utilisateur quitte ou restart
function handleRestart() {
  abortController.abort();             // Annuler main question
  prefetchAbortController.abort();     // Annuler prefetch

  // Créer nouveaux controllers
  setAbortController(new AbortController());
  setPrefetchAbortController(new AbortController());

  dispatch({ type: 'RESET_TO_LOBBY' });
}
```

### Async effects et cleanup

```javascript
/**
 * Effet: quand question prête, lancer prefetch de la suivante
 */
useEffect(() => {
  if (state.question && state.isGameActive) {
    prefetch(state.activeFilters);
  }

  return () => {
    // Cleanup si component unmount
    prefetchAbortController.abort();
  };
}, [state.question, state.isGameActive, state.activeFilters, prefetch]);

/**
 * Effet: maxQuestions atteint → finalize game
 */
useEffect(() => {
  if (
    state.isGameActive &&
    state.maxQuestions &&
    state.questionCount > state.maxQuestions
  ) {
    dispatch({ type: 'GAME_OVER' });
  }
}, [state.questionCount, state.maxQuestions, state.isGameActive]);
```

---

## 🎬 Lifecycle d'une partie

### Exemple: Utilisateur joue 3 questions

#### 0. Initial state

```javascript
{
  isGameActive: false,
  isGameOver: false,
  question: null,
  nextQuestion: null,
  questionCount: 1,
  score: 0,
  streak: 0,
}
```

#### 1. Utilisateur clique "Commencer"

```javascript
dispatch({
  type: 'GAME_START',
  payload: { filters: { pack: 'mushrooms' } }
});

// State → LOADING
// isGameActive = true
// question = null
// Déclenche fetchQuestion()
```

**Render** : `<PlayPage>` → affiche `<Spinner />`

#### 2. API répond avec question 1

```javascript
// Fetch complète
const q1 = { id: 'q1', images: [...], taxon: {...}, choices: [...] };

dispatch({
  type: 'SET_QUESTION',
  payload: q1
});

// State → PLAYING
// question = q1
// Déclenche prefetch question 2

// Simultanément dans effect: prefetch()
const q2 = await fetchQuestion(filters);
dispatch({
  type: 'SET_NEXT_QUESTION',
  payload: q2
});

// State → nextQuestion = q2
```

**Render** : `<PlayPage>` → `<EasyMode question={q1} />` + Chronomètre

#### 3. Utilisateur répond correctement

```javascript
// EasyMode.jsx appelle onComplete()
onComplete({ correct: true, timeMs: 8500 });

dispatch({
  type: 'COMPLETE_ROUND',
  payload: { correct: true, timeMs: 8500, biomes: ['forest'] }
});

// State → SUMMARY
// score = 10 (+10 pour réponse correct)
// streak = 1
// questionCount = 2
// roundResults = [{ correct: true, timeMs: 8500, ... }]
```

**Render** : `<PlayPage>` → `<RoundSummaryModal score={10} streak={1} />`

#### 4. Utilisateur clique "Continuer"

```javascript
// Modal.jsx appelle onContinue()
const newQuestion = state.nextQuestion;  // q2 (déjà préchargé)

dispatch({
  type: 'SET_QUESTION',
  payload: newQuestion
});

// State → PLAYING
// question = q2
// nextQuestion = null (pas encore préchargée)
// Déclenche prefetch question 3 immédiatement

const q3 = await fetchQuestion(filters);
dispatch({
  type: 'SET_NEXT_QUESTION',
  payload: q3
});
```

**Render** : `<PlayPage>` → `<EasyMode question={q2} />` (immédiat, pas de spinner)

#### 5. Utilisateur répond incorrectement

```javascript
dispatch({
  type: 'COMPLETE_ROUND',
  payload: { correct: false, timeMs: 3200, biomes: [...] }
});

// State → SUMMARY
// score = 10 (pas d'ajout, réponse mauvaise)
// streak = 0 (reset)
// questionCount = 3
```

#### 6. Utilisateur termine après 3 questions

(Supposant maxQuestions = 3)

```javascript
// Effect détecte: questionCount (3) > maxQuestions (3)
// Triggered effect:

if (state.questionCount > state.maxQuestions) {
  dispatch({ type: 'GAME_OVER' });
}

// State → GAME_OVER
// isGameActive = false
// isGameOver = true
```

**Navigation** : Redirect `/end` → afficher `<EndScreen />` avec:
- Score final: 10
- Max streak: 1
- Espèces vues: [q1.taxon, q2.taxon, q3.taxon]
- Achievements débloqués

---

## ⚠️ Erreurs et edge cases

### Erreur: API fail

```javascript
try {
  const response = await fetch('/api/quiz-question', { signal });
  if (!response.ok) {
    throw new Error(`API ${response.status}`);
  }
  // ...
} catch (error) {
  if (error.name === 'AbortError') {
    // Ignoré (cancel intentionnel)
  } else {
    dispatch({
      type: 'SET_ERROR',
      payload: { code: 'API_ERROR', message: error.message }
    });
    // Afficher ErrorModal pour retry/reset
  }
}
```

### Edge case: Utilisateur clique "Restart" pendant prefetch

```javascript
function handleRestart() {
  // Annuler toutes requêtes en cours
  abortController.abort();
  prefetchAbortController.abort();

  // Effet des AbortError:
  // - fetchQuestion() catch → ignorer AbortError
  // - prefetch() catch → ignorer AbortError
  // - Pas de state update orpheline

  // Reset state
  dispatch({ type: 'RESET_TO_LOBBY' });
}
```

### Edge case: Utilisateur retour avant réponse

(Naviguer loin du PlayPage avant répondre)

```javascript
// Component unmount
useEffect(() => {
  return () => {
    // Cleanup
    abortController.abort();
    prefetchAbortController.abort();
    // Pas de memory leak
  };
}, []);
```

### Edge case: Deux réponses envoyées rapidement

```javascript
// Mode "hard" : utilisateur peut cliquer 2x avant transition
// Solution: Disable button après première réponse

const [isAnswered, setIsAnswered] = useState(false);

function handleAnswer() {
  if (isAnswered) return;  // Ignore second click
  setIsAnswered(true);
  onComplete({ correct, ... });
}

// Cleanup de button au changement question
useEffect(() => {
  setIsAnswered(false);
}, [question]);
```

---

## 📊 Debugging state

### Exposer GameContext en DevTools

```javascript
// Dans development, exposer sur window
if (process.env.NODE_ENV === 'development') {
  window.gameState = state;
  window.gameDispatch = dispatch;
}

// Dans DevTools console:
// gameState
// gameDispatch({ type: 'GAME_OVER' })
```

### React DevTools

1. Installer React DevTools extension
2. Inspecter `GameContext` dans Components tree
3. Voir state mutations en temps réel
4. Profiler rendering performance

---

## 🔗 Ressources

- [ARCHITECTURE.md](../ARCHITECTURE.md) – State machine diagram
- [PWA_OFFLINE.md](./PWA_OFFLINE.md) – IndexedDB persistence
- [COMPONENTS.md](./COMPONENTS.md) – Composants consommant GameContext
