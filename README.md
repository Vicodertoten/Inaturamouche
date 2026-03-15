# iNaturaQuizz

Quiz naturaliste educatif base sur des observations iNaturalist. Frontend React (PWA) + API Express.

## Fonctionnalites principales

- **2 modes de jeu actifs**: Easy, Hard (les modes Riddle et Taxonomic sont archives)
- **44 packs thematiques**: Discovery (14), Threatened (12), Curated (14), Creative (4)
- **Systeme de progression**: XP, niveaux, streak, achievements, collection d'especes
- **IA educative**: Explications personnalisees via Gemini 2.5 Flash (RAG + JSON structure)
- **PWA offline-ready**: Installation sur device, cache intelligent
- **Multilingue**: fr, en, nl avec detection automatique
- **Partage**: Collections et defis partageables
- **Metrics first-party**: Analyse produit sans tracking tiers invasif

## Liens rapides

- [wiki/INDEX.md](wiki/INDEX.md) — point d'entrée documentation
- [wiki/GETTING_STARTED.md](wiki/GETTING_STARTED.md) — démarrage local
- [wiki/ARCHITECTURE.md](wiki/ARCHITECTURE.md) — vue d'ensemble
- [wiki/API_REFERENCE.md](wiki/API_REFERENCE.md) — endpoints API
- [wiki/BETA_SMOKE_MATRIX.md](wiki/BETA_SMOKE_MATRIX.md) — matrice smoke beta
- [docs/reference/](docs/reference/) — documentation de référence détaillée (6 fichiers)
- [docs/explanation/](docs/explanation/) — documentation d'explication (7 fichiers, diagrammes Mermaid)
- [CONTRIBUTING.md](CONTRIBUTING.md) — guide de contribution

## Demarrage local

Prerequis:
- Node.js 22+
- npm 10+

Installation:

```bash
npm ci
npm --prefix client ci
cp .env.example .env
```

Dev (2 terminaux):

```bash
# Terminal 1
npm run dev

# Terminal 2
npm --prefix client run dev
```

- API: `http://localhost:3001`
- Front: `http://localhost:5173`

## Stack technique

**Backend:**
- Express 5, Node.js 20+
- Gemini 2.5 Flash (IA avec JSON structure)
- Zod validation, Pino logging
- SmartCache (TTL + stale)
- iNaturalist API + Wikipedia RAG

**Frontend:**
- React 19, React Router, Vite
- Zustand (state), TanStack Query
- Leaflet maps, Dexie (IndexedDB)
- PWA (vite-plugin-pwa)
- Vitest + Playwright E2E

**Data:**
- 44 packs V3 (dynamic + list-based)
- iNaturalist observations (CC licenses)
- Local storage: progression, preferences

## Donnees et attribution

Les observations et photos proviennent de iNaturalist. Les licences sont celles choisies par les auteurs (CC0, CC BY, CC BY-NC). L attribution est affichee dans l application et dans les pages legales.

## Confidentialite

Pas de compte requis, pas de tracking tiers. Les preferences et progressions sont stockees localement dans le navigateur.
Pendant la beta, des metriques produit first-party (sans SDK tiers) sont collectees pour piloter la stabilite.

## Beta readiness (72h gate)

Verifier les seuils KPI avant une ouverture publique:

```bash
npm run beta:thresholds
```

Injecter une session smoke KPI (utile pour eviter NODATA pendant la preparation):

```bash
# app_open + round_start + quiz-question + quiz-submit + round_complete
npm run beta:smoke

# inclure aussi un report (alimente report_success_rate)
npm run beta:smoke -- --with-report
```

Le script:
- lit `/api/metrics/dashboard` sur 72h et 1h
- verifie les seuils (activation, completion, erreurs API, crash-free, succes reports, p95 quiz)
- applique des minimums d echantillons par KPI (72h et 1h) pour eviter les faux positifs
- maintient un historique horaire local (`server/data/beta-thresholds-history.json`)
- calcule une streak 72h sur les checks de stabilite (`api_error_rate`, `quiz-question p95`, `quiz-submit p95`)
- traite une heure "NODATA" comme neutre pour la streak (ne compte pas, ne casse pas)
- retourne un code non-zero si le gate est rouge

Variables utiles: `METRICS_BASE_URL`, `METRICS_DASHBOARD_TOKEN`, `BETA_REQUIRE_72H`, `BETA_MIN_*`.

## Licence

ISC. Voir le fichier LICENSE.
