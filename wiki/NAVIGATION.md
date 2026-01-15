# Wiki Structure & Navigation

Arborescence complète de la documentation réorganisée.

## 📚 Vue d'ensemble

```
/wiki/
├── README.md                    # 👈 START HERE: Quick start + overview
├── ARCHITECTURE.md              # Pipeline complet + diagrammes (Front+Back)
├── GETTING_STARTED.md          # Dev setup, commandes npm, .env
├── CONTRIBUTING.md             # Conventions code, i18n, tests, workflow
├── API_REFERENCE.md            # Contrats routes, exemples cURL
│
├── guides/
│   ├── backend/
│   │   ├── QUIZ_PIPELINE.md           # Détail algorithmes (LCA, anti-rep, etc.)
│   │   ├── CACHE_STRATEGY.md          # SmartCache, TTL, SWR, scaling Redis
│   │   └── OBSERVABILITY.md           # Headers debug, logs Pino, tracing
│   │
│   ├── frontend/
│   │   ├── GAME_STATE.md              # GameContext, state machine, lifecycle
│   │   ├── PWA_OFFLINE.md             # Service Worker, cache policies, IndexedDB
│   │   ├── COMPONENTS.md              # [À créer] Catalogue composants
│   │   └── STYLING.md                 # [À créer] CSS organization, thèmes
│   │
│   └── ops/
│       ├── DEPLOYMENT.md              # Docker, Netlify, Render, env vars
│       └── MONITORING.md              # [À créer] Logs, alertes, metrics
│
└── diagrams/                    # [À créer] Fichiers Mermaid
    ├── quiz-pipeline.mmd
    ├── state-machine.mmd
    └── cache-strategy.mmd
```

---

## 🎯 Commencer ici

### Pour les **nouveaux développeurs** (onboarding)

1. **[README.md](./README.md)** – Vue générale, Quick Start
2. **[GETTING_STARTED.md](./GETTING_STARTED.md)** – Installation locale
3. **[ARCHITECTURE.md](./ARCHITECTURE.md)** – Comprendre le system
4. **[CONTRIBUTING.md](./CONTRIBUTING.md)** – Comment contribuer

### Pour les **mainteneurs** (deep dive)

- **Backend** → [QUIZ_PIPELINE.md](./guides/backend/QUIZ_PIPELINE.md) + [CACHE_STRATEGY.md](./guides/backend/CACHE_STRATEGY.md)
- **Frontend** → [GAME_STATE.md](./guides/frontend/GAME_STATE.md) + [PWA_OFFLINE.md](./guides/frontend/PWA_OFFLINE.md)
- **Deployment** → [DEPLOYMENT.md](./guides/ops/DEPLOYMENT.md)
- **Debug** → [OBSERVABILITY.md](./guides/backend/OBSERVABILITY.md)

### Pour les **utilisateurs API** (intégration)

1. **[API_REFERENCE.md](./API_REFERENCE.md)** – Tous les endpoints
2. **[OBSERVABILITY.md](./guides/backend/OBSERVABILITY.md)** – Headers debug, monitoring

---

## 📖 Résumé par fichier

### 🏠 Index & Quick Start

#### [README.md](./README.md)
- **Contenu** :
  - Vision du projet (pourquoi Inaturamouche)
  - Features clés (phylogénie, LCA, PWA, offline)
  - Quick Start (5 min pour démarrer)
  - Stack technique (React, Express, Zod, Pino)
  - Navigation vers autres docs
- **Public** : Tous (newbies à mainteneurs)
- **Durée lecture** : 10 min

#### [GETTING_STARTED.md](./GETTING_STARTED.md)
- **Contenu** :
  - Prérequis (Node 20+, npm 10+)
  - Installation step-by-step
  - Variables d'environnement (.env)
  - Commandes npm (dev, build, test, lint)
  - Structure répertoires
  - Troubleshooting
  - Checklist onboarding
- **Public** : Developers
- **Durée lecture** : 20 min

#### [CONTRIBUTING.md](./CONTRIBUTING.md)
- **Contenu** :
  - Avant de commencer (Code of Conduct)
  - Flux contribution (fork → branch → PR)
  - Conventions de code (JS, React, tests)
  - i18n workflow (parity check, traductions)
  - Conventions commits
  - CI/CD workflow
  - Template PR
- **Public** : Contributors
- **Durée lecture** : 20 min

---

### 🏗️ Architecture

#### [ARCHITECTURE.md](./ARCHITECTURE.md)
- **Contenu** :
  - Concepts clés (LCA, phylogénie)
  - Pipeline question détaillé (11 étapes)
  - State machine (LOBBY → LOADING → PLAYING → SUMMARY → GAME_OVER)
  - Stratégie cache (SmartCache LRU+SWR)
  - Observabilité (Server-Timing, X-headers)
  - Limitations + roadmap
  - Diagrammes Mermaid
- **Public** : Tous (architecture overview)
- **Durée lecture** : 30 min

#### [API_REFERENCE.md](./API_REFERENCE.md)
- **Contenu** :
  - Endpoints : `/api/quiz-question`, `/api/taxa/autocomplete`, `/api/places`, etc.
  - Request/response schemas
  - Codes erreur
  - Headers debug
  - Exemples cURL
  - Rate limiting, versioning, sécurité
- **Public** : API users, intégrateurs
- **Durée lecture** : 20 min

---

### 🔌 Backend Guides

#### [QUIZ_PIPELINE.md](./guides/backend/QUIZ_PIPELINE.md)
- **Contenu** :
  - Validation & normalisation (Zod)
  - Fetch observations (pagination, retries)
  - Indexation par taxon
  - Sélection taxon (LCA, cooldown, deck mélangé)
  - Sélection observation (anti-répétition)
  - Génération leurres (LCA bucketing: near/mid/far)
  - Enrichissement taxa (Wikipedia)
  - Construction réponse finale
  - Code examples détaillés
  - Exemple complet end-to-end
- **Public** : Backend developers, architects
- **Durée lecture** : 40 min

#### [CACHE_STRATEGY.md](./guides/backend/CACHE_STRATEGY.md)
- **Contenu** :
  - SmartCache architecture (LRU + SWR)
  - TTL vs SWR (formule, timeline)
  - 5 caches expliqués : questionCache, selectionStateCache, taxonDetailsCache, autocompleteCache, questionQueueCache
  - Circuit Breaker (fail-fast)
  - Limitations (no persistence, no distribution, fixed TTL, anti-rep naïf)
  - Solutions futures (Redis, sticky sessions, TTL adaptatif, Bloom filter)
  - Benchmarks (memory, hit rates, iNat reduction)
- **Public** : Backend developers, devops, architects
- **Durée lecture** : 35 min

#### [OBSERVABILITY.md](./guides/backend/OBSERVABILITY.md)
- **Contenu** :
  - Headers réponse (Server-Timing, X-Cache-Key, X-Lure-Buckets, X-Pool-*, etc.)
  - DevTools network inspection
  - Logs Pino structurés (JSON, filtering)
  - Tracing & correlation ID (X-Request-Id)
  - Monitoring & alertes (Prometheus, Grafana)
  - Debugging scenarios (requête lente, pool petit, cache miss, etc.)
  - Examples grep, curl, jq
- **Public** : Backend developers, devops, support
- **Durée lecture** : 25 min

---

### 🎮 Frontend Guides

#### [GAME_STATE.md](./guides/frontend/GAME_STATE.md)
- **Contenu** :
  - GameContext architecture (useReducer, dispatch)
  - Initial state structure
  - Action types (GAME_START, SET_QUESTION, COMPLETE_ROUND, GAME_OVER, etc.)
  - État machine visuelle (LOBBY → LOADING → PLAYING → SUMMARY → GAME_OVER)
  - Hooks (usePrefetchQuestion, useGame)
  - AbortController (annulation requêtes)
  - Lifecycle exemple (3 questions complètes)
  - Erreurs & edge cases
  - Debugging avec DevTools
- **Public** : Frontend developers
- **Durée lecture** : 35 min

#### [PWA_OFFLINE.md](./guides/frontend/PWA_OFFLINE.md)
- **Contenu** :
  - PWA configuration (vite.config.js, manifest, offline.html)
  - Service Worker & cache policies (NetworkOnly, SWR, CacheFirst)
  - Offline-first workflow (2 scénarios)
  - IndexedDB persistence (Dexie, gameSessions, achievements)
  - React hooks (useLiveQuery, useProfile, useGameSessions)
  - Troubleshooting (cache stale, offline fail, install issues)
  - Performance metrics & optimisations
- **Public** : Frontend developers, product (offline support)
- **Durée lecture** : 30 min

#### [COMPONENTS.md](./guides/frontend/COMPONENTS.md) ❌ À créer
- **À inclure** :
  - ImageViewer (zoom, pan, prefetch, keyboard nav)
  - AutocompleteInput
  - RoundSummaryModal
  - StreakBadge
  - AchievementModal
  - PreferencesMenu
  - GeoFilter, Configurator, CustomFilter
  - PhylogeneticTree
  - EasyMode, HardMode
  - EndScreen
  - AppLayout, BottomNavigationBar
  - ErrorModal, HelpModal, Spinner

#### [STYLING.md](./guides/frontend/STYLING.md) ❌ À créer
- **À inclure** :
  - Organisation CSS (modules, globals, utilities)
  - Variables CSS (colors, spacing, fonts)
  - Thèmes (light/dark)
  - Responsive breakpoints
  - Animations & transitions
  - Accessibility (a11y, color contrast)

---

### ⚙️ Ops Guides

#### [DEPLOYMENT.md](./guides/ops/DEPLOYMENT.md)
- **Contenu** :
  - Architecture déploiement (Netlify front + Render back)
  - Build & CI/CD (GitHub Actions)
  - Déploiement Frontend (Netlify)
  - Déploiement Backend (Render)
  - Docker (build, run locally, push à registry)
  - Environment variables
  - Monitoring & logging (Render logs, Pino, health check)
  - Scaling & performance (starter → production phases)
  - Deployment checklist
- **Public** : DevOps, maintainers, backends
- **Durée lecture** : 30 min

#### [MONITORING.md](./guides/ops/MONITORING.md) ❌ À créer
- **À inclure** :
  - Setup Prometheus
  - Setup Grafana dashboards
  - Alert rules (latency, cache, errors)
  - Log aggregation (Datadog, New Relic)
  - Performance profiling
  - SLA monitoring

---

## 🔗 Cross-references

### From README.md
→ [GETTING_STARTED.md](./GETTING_STARTED.md) (installation)
→ [ARCHITECTURE.md](./ARCHITECTURE.md) (design overview)
→ [CONTRIBUTING.md](./CONTRIBUTING.md) (contribute)

### From ARCHITECTURE.md
→ [QUIZ_PIPELINE.md](./guides/backend/QUIZ_PIPELINE.md) (pipeline detail)
→ [CACHE_STRATEGY.md](./guides/backend/CACHE_STRATEGY.md) (cache detail)
→ [GAME_STATE.md](./guides/frontend/GAME_STATE.md) (state machine detail)

### From CONTRIBUTING.md
→ [GETTING_STARTED.md](./GETTING_STARTED.md) (setup first)
→ [API_REFERENCE.md](./API_REFERENCE.md) (for API changes)

### From OBSERVABILITY.md
→ [CACHE_STRATEGY.md](./guides/backend/CACHE_STRATEGY.md) (cache internals)
→ [QUIZ_PIPELINE.md](./guides/backend/QUIZ_PIPELINE.md) (pipeline internals)

---

## 📊 Statistics

| Document | Lines | Durée | Niveau |
|----------|-------|-------|--------|
| README.md | ~200 | 10 min | Beginner |
| GETTING_STARTED.md | ~300 | 20 min | Beginner |
| ARCHITECTURE.md | ~400 | 30 min | Intermediate |
| CONTRIBUTING.md | ~250 | 20 min | Beginner |
| API_REFERENCE.md | ~300 | 20 min | Intermediate |
| QUIZ_PIPELINE.md | ~500 | 40 min | Advanced |
| CACHE_STRATEGY.md | ~450 | 35 min | Advanced |
| OBSERVABILITY.md | ~350 | 25 min | Advanced |
| GAME_STATE.md | ~400 | 35 min | Advanced |
| PWA_OFFLINE.md | ~400 | 30 min | Intermediate |
| DEPLOYMENT.md | ~350 | 30 min | Intermediate |
| **TOTAL** | **~4100** | **4 hours** | Mixed |

---

## 🎓 Curriculum suggested

### Week 1 (Onboarding new dev)

| Day | Task | Duration |
|-----|------|----------|
| 1 | Read README.md, GETTING_STARTED.md | 30 min |
| 1 | Install & run locally (`npm run dev`) | 30 min |
| 2 | Read ARCHITECTURE.md (overview) | 45 min |
| 3 | Read CONTRIBUTING.md (conventions) | 30 min |
| 3 | Make first commit (small fix) | 1h |
| 4 | Read GAME_STATE.md OR QUIZ_PIPELINE.md | 45 min |
| 5 | Implement small feature (choose backend or frontend) | 2-3h |

### Week 2+ (Deep dive)

**Backend focus** :
- [QUIZ_PIPELINE.md](./guides/backend/QUIZ_PIPELINE.md)
- [CACHE_STRATEGY.md](./guides/backend/CACHE_STRATEGY.md)
- [OBSERVABILITY.md](./guides/backend/OBSERVABILITY.md)

**Frontend focus** :
- [GAME_STATE.md](./guides/frontend/GAME_STATE.md)
- [PWA_OFFLINE.md](./guides/frontend/PWA_OFFLINE.md)
- [COMPONENTS.md](./guides/frontend/COMPONENTS.md) (once written)

**DevOps focus** :
- [DEPLOYMENT.md](./guides/ops/DEPLOYMENT.md)
- [MONITORING.md](./guides/ops/MONITORING.md) (once written)

---

## ✅ Checklist création docs

### Complété ✅
- [x] README.md
- [x] GETTING_STARTED.md
- [x] ARCHITECTURE.md
- [x] CONTRIBUTING.md
- [x] API_REFERENCE.md
- [x] QUIZ_PIPELINE.md
- [x] CACHE_STRATEGY.md
- [x] OBSERVABILITY.md
- [x] GAME_STATE.md
- [x] PWA_OFFLINE.md
- [x] DEPLOYMENT.md
- [x] This navigation guide

### À créer ⏳
- [ ] COMPONENTS.md (frontend)
- [ ] STYLING.md (frontend)
- [ ] MONITORING.md (ops)
- [ ] Diagrammes Mermaid (quiz-pipeline, state-machine, cache-strategy)
- [ ] Video walkthroughs (optionnel)
- [ ] Setup video (onboarding)

---

## 🚀 Prochaines étapes

1. **Valider** la structure avec l'équipe
2. **Créer** les docs manquantes (COMPONENTS, STYLING, MONITORING)
3. **Générer** diagrammes Mermaid
4. **Intégrer** dans wiki GitHub / GitBook / Docusaurus (optionnel)
5. **Ajouter** des examples vidéo onboarding
6. **Mettre à jour** README racine pour pointer vers `/wiki/README.md`
7. **CI hook** : Valider liens internes dans docs

---

## 📝 Notes

- Tous les fichiers sont en **Markdown** (compatible GitHub, Docusaurus, GitBook)
- Chemins de liens : **relatifs** (`./ARCHITECTURE.md`, `./guides/backend/CACHE_STRATEGY.md`)
- Code examples : **JavaScript/Python** (exécutables/copiables)
- Diagrammes : **Mermaid.js** (rendus natifs GitHub)
- Public : Pour tous les profils (beginners à experts)
- Maintenabilité : Update si algo/pipeline change
