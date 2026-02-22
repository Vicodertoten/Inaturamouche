# iNaturaQuizz

Quiz naturaliste educatif base sur des observations iNaturalist. Frontend React (PWA) + API Express.

## Liens rapides

- `wiki/INDEX.md`
- `wiki/GETTING_STARTED.md`
- `wiki/ARCHITECTURE.md`
- `wiki/API_REFERENCE.md`
- `wiki/BETA_SMOKE_MATRIX.md`
- `CONTRIBUTING.md`

## Demarrage local

Prerequis:
- Node.js 20+
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
