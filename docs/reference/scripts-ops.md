# Scripts & Ops Reference

> **Source de vérité** — Généré à partir de `scripts/`, `package.json`, `client/package.json`, `Dockerfile.fly`, `fly.toml`, `netlify.toml`.

---

## 1. npm Scripts

### Racine (`package.json`)

| Commande | Description |
|----------|-------------|
| `npm start` | Démarre le serveur (`node server/index.js`) |
| `npm run dev` | Démarre le serveur en mode watch (`nodemon server/index.js`) |
| `npm test` | Tests unitaires serveur + client |
| `npm run test:unit` | Tests unitaires uniquement (`tests/*.test.mjs` + `tests/server/*.test.mjs`) |
| `npm run test:integration` | Tests d'intégration (`tests/integration/*.test.mjs`) |
| `npm run test:all` | Tous les tests (unit + integration + client) |
| `npm run ci` | Pipeline CI complète : lint serveur → i18n → unit → integration → client |
| `npm run lint` | Lint client (ESLint via client/) |
| `npm run lint:server` | Lint serveur + scripts (`eslint.server.cjs`) |
| `npm run build` | Build production du client (Vite) |
| `npm run check:i18n` | Compare les clés i18n entre `fr.js`, `en.js`, `nl.js` |
| `npm run smoke:test` | Smoke test HTTP (`scripts/smoke-test.sh`) |
| `npm run reports` | Consulter les rapports de bugs (`scripts/view-reports.js`) |
| `npm run beta:smoke` | Smoke test synthétique pour KPI boot (`scripts/run-beta-smoke.mjs`) |
| `npm run beta:thresholds` | Vérification des seuils beta KPI (`scripts/check-beta-thresholds.mjs`) |
| `npm run packs:resolve:places` | Résolution des places iNaturalist |
| `npm run packs:resolve:taxa` | Résolution des taxons iNaturalist |
| `npm run packs:validate:taxa-health` | Validation de la santé des taxons dans les packs |
| `npm run packs:build:list-json` | Génération des fichiers JSON pour les packs list |

### Client (`client/package.json`)

| Commande | Description |
|----------|-------------|
| `npm run dev` | Serveur Vite en dev (port 5173, proxy `/api` → `:3001`) |
| `npm run build` | Build production Vite |
| `npm run preview` | Preview du build en local |
| `npm run lint` | ESLint (`--max-warnings=0`) |
| `npm run test` | Vitest (watch mode) |
| `npm run test:unit` | Vitest (alias) |
| `npm run test:e2e` | Playwright end-to-end |
| `npm run test:ci` | Vitest run + coverage + Playwright |

---

## 2. Scripts utilitaires

### Packs & Données

| Script | Commande npm | Description |
|--------|-------------|-------------|
| `scripts/resolve-places.mjs` | `packs:resolve:places` | Résout les noms de lieux vers leurs IDs iNaturalist. Lit/écrit `server/packs/places.js`. |
| `scripts/resolve-taxa.mjs` | `packs:resolve:taxa` | Résout les noms de taxons vers leurs IDs iNaturalist. Lit/écrit `server/packs/taxa.js`. |
| `scripts/validate-taxa-health.mjs` | `packs:validate:taxa-health` | Vérifie la santé des packs list : chaque taxon existe sur iNaturalist et est actif. Génère un rapport. |
| `scripts/build-list-pack-json.mjs` | `packs:build:list-json` | Génère les fichiers JSON `shared/data/*.json` pour les packs de type `list`. |
| `scripts/check-taxa-ids.mjs` | — | Vérifie si les IDs de taxons existent dans l'API iNaturalist. Script de diagnostic standalone. |
| `scripts/audit-packs.mjs` | — | Audit des fichiers de données (ex: doublons, IDs manquants). |

### i18n

| Script | Commande npm | Description |
|--------|-------------|-------------|
| `scripts/i18n-compare.cjs` | `check:i18n` | Compare les clés de traduction entre les fichiers locales (`fr.js`, `en.js`, `nl.js`). Détecte les clés manquantes ou en trop. |
| `scripts/i18n-compare.js` | — | Copie/version alternative du script i18n. |

### Beta & Smoke

| Script | Commande npm | Description |
|--------|-------------|-------------|
| `scripts/run-beta-smoke.mjs` | `beta:smoke` | Exécute des requêtes synthétiques pour générer du trafic KPI minimal (bootstrapping). Configurable via `BETA_SMOKE_PACK_ID` et `BETA_SMOKE_LOCALE`. |
| `scripts/check-beta-thresholds.mjs` | `beta:thresholds` | Évalue les KPI sur 72h/1h contre les seuils configurés. Sort GO/NO-GO pour le déploiement production. Historise dans `beta-thresholds-history.json`. |
| `scripts/smoke-test.sh` | `smoke:test` | Smoke test HTTP basique : vérifie que les endpoints principaux répondent correctement. |

### IA & Diagnostique

| Script | Commande npm | Description |
|--------|-------------|-------------|
| `scripts/audit-ai-explanations.mjs` | — | Audit des explications IA générées. Vérifie la qualité, la structure et la conformité des réponses Gemini. Génère un rapport JSON dans `tmp/`. |
| `scripts/view-reports.js` | `reports` | Affiche les rapports de bugs stockés dans `server/data/reports-store.json`. |

---

## 3. Déploiement

### Frontend — Netlify

> Source : `netlify.toml`

| Paramètre | Valeur |
|-----------|--------|
| Build command | `npm run build` |
| Publish dir | `client/dist` |
| Base | `client` |
| Proxy | `/api/*` → Fly.io |

**Headers** : configurés via `client/public/_headers` (CSP, cache).
**Redirects** : configurés via `client/public/_redirects` (SPA fallback).

### Backend — Fly.io

> Source : `Dockerfile.fly`, `fly.toml`

| Paramètre | Valeur |
|-----------|--------|
| Région | `cdg` (Paris) |
| Mémoire | 256 MB |
| Machines min | 1 |
| Auto-stop | activé |
| Health check | `GET /healthz` (interval 15s, timeout 5s) |
| Port interne | 3001 |

**Dockerfile.fly** : multi-stage build, Node 22 Alpine, production dependencies only.

---

## 4. Configuration de développement

### Nodemon

> Source : `nodemon.json`

Surveille les changements dans `server/`, `lib/`, `shared/` et redémarre automatiquement.

### Vite Dev Proxy

Le serveur Vite en dev (port 5173) proxifie `/api/*` vers `localhost:3001`, permettant de développer frontend et backend simultanément.

### Variables d'environnement

Voir [configuration.md](configuration.md) pour la référence complète de `.env`.

---

## 5. CI Pipeline

> Source : commande `npm run ci`

```
1. npm run lint:server    ← ESLint sur server/ et scripts/
2. npm run check:i18n     ← Cohérence clés i18n (fr=en=nl)
3. npm run test:unit      ← Tests unitaires serveur (node --test)
4. npm run test:integration ← Tests d'intégration serveur
5. npm --prefix client run test:ci ← Vitest + coverage + Playwright
```
