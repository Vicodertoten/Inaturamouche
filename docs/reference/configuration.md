# Configuration Reference

> **Source de vérité** — Généré à partir de `server/config/index.js` et `.env.example`.

Toutes les variables sont lues via `process.env` avec des valeurs par défaut sensées. Les valeurs numériques sont clampées dans des bornes `[min, max]` pour éviter les configurations dangereuses.

---

## Fonctions utilitaires internes

| Fonction | Description |
|----------|-------------|
| `parseIntWithFallback(value, fallback, {min, max})` | Parse un entier avec fallback et clamp |
| `parseFloatWithFallback(value, fallback, {min, max})` | Parse un flottant avec fallback et clamp |
| `parseBoolean(value, fallback)` | Parse un booléen (`true/1/yes/on` → `true`, `false/0/no/off` → `false`) |
| `parseCsvList(value, fallback)` | Parse une liste CSV (trim, normalise, déduplique) |

---

## Serveur

| Variable | Type | Défaut | Min | Max | Description |
|----------|------|--------|-----|-----|-------------|
| `PORT` | int | `3001` | — | — | Port d'écoute du serveur |
| `NODE_ENV` | string | `development` | — | — | Environnement (`development`, `production`, `test`) |
| `ENABLE_STARTUP_WARMUP` | bool | `true` en prod | — | — | Active le warmup des pools de questions au démarrage |
| `STARTUP_WARMUP_DELAY_MS` | int | `1000` | 0 | 300 000 | Délai avant le premier warmup (ms) |
| `WARMUP_INTERVAL_MS` | int | `900 000` (15 min) | 60 000 | 86 400 000 | Intervalle entre les warmups périodiques (ms) |

---

## Proxy

| Variable | Type | Défaut | Description |
|----------|------|--------|-------------|
| `TRUST_PROXY_LIST` | string | `loopback,uniquelocal` | Liste trust-proxy Express (derrière un reverse proxy) |

---

## CORS

| Variable | Type | Défaut | Description |
|----------|------|--------|-------------|
| `CORS_ORIGINS` | csv | `localhost:5173, inaturaquizz.com, www.inaturaquizz.com, inaturamouche.netlify.app` | Origines autorisées (séparées par virgule) |
| `CORS_ORIGIN` | csv | — | Alias accepté pour `CORS_ORIGINS` (singulier) |

---

## Timeouts & Retries (iNaturalist)

| Variable | Type | Défaut | Min | Max | Description |
|----------|------|--------|-----|-----|-------------|
| `INAT_REQUEST_TIMEOUT_MS` | int | `5000` | 500 | 30 000 | Timeout par requête vers iNaturalist (ms) |
| `INAT_MAX_RETRIES` | int | `1` | 0 | 6 | Nombre de retries par requête |
| `INAT_MAX_CONCURRENT_REQUESTS` | int | `14` | 2 | 200 | Requêtes concurrentes max vers iNat |
| `INAT_BACKOFF_BASE_MS` | int | `350` | 50 | 5 000 | Base exponentielle du backoff (ms) |
| `INAT_BACKOFF_MAX_MS` | int | `6000` | 300 | 60 000 | Plafond du backoff (ms) |

---

## IA (Gemini 2.5 Flash)

| Variable | Type | Défaut | Min | Max | Description |
|----------|------|--------|-----|-----|-------------|
| `AI_API_KEY` | string | — | — | — | Clé API Google AI (requise pour les explications) |
| `AI_ENABLED` | bool | `true` | — | — | Active/désactive le service IA |
| `EXPLAIN_RATE_LIMIT_PER_MINUTE` | int | `8` | 1 | 200 | Limite d'explications par minute par IP |
| `EXPLAIN_DAILY_QUOTA_PER_IP` | int | `60` | 1 | 5 000 | Quota journalier d'explications par IP |

---

## Reports (Bug reports)

| Variable | Type | Défaut | Min | Max | Description |
|----------|------|--------|-----|-----|-------------|
| `REPORTS_REQUIRE_WRITE_TOKEN` | bool | `false` | — | — | Force l'auth Bearer sur `POST /api/reports` |
| `REPORTS_WRITE_TOKEN` | string | — | — | — | Token pour soumettre des rapports |
| `REPORTS_READ_TOKEN` | string | — | — | — | Token pour lire les rapports |
| `REPORTS_RATE_LIMIT_PER_WINDOW` | int | `8` | 1 | 200 | Nombre max de rapports par fenêtre |
| `REPORTS_RATE_LIMIT_WINDOW_MS` | int | `600 000` (10 min) | 10 000 | 86 400 000 | Fenêtre du rate limit (ms) |
| `REPORTS_STORE_FILE` | string | `server/data/reports-store.json` | — | — | Chemin du fichier de stockage |
| `REPORTS_MAX_ENTRIES` | int | `3000` | 100 | 100 000 | Nombre max de rapports conservés |
| `REPORTS_RETENTION_DAYS` | int | `45` | 1 | 365 | Durée de rétention (jours) |
| `REPORTS_IP_HASH_SALT` | string | `ROUND_HMAC_SECRET` ou `dev-...` | — | — | Sel pour le hash de l'IP (pseudonymisation) |

---

## Metrics (First-party analytics)

| Variable | Type | Défaut | Min | Max | Description |
|----------|------|--------|-----|-----|-------------|
| `METRICS_STORE_FILE` | string | `server/data/metrics-store.json` | — | — | Chemin du fichier de stockage événements |
| `METRICS_RETENTION_HOURS` | int | `336` (14 jours) | 24 | 2 160 (90j) | Durée de rétention des événements (heures) |
| `METRICS_MAX_API_EVENTS` | int | `200 000` | 1 000 | 2 000 000 | Événements API max en mémoire |
| `METRICS_MAX_CLIENT_EVENTS` | int | `100 000` | 1 000 | 1 000 000 | Événements client max en mémoire |
| `METRICS_DASHBOARD_TOKEN` | string | `""` | — | — | Token pour accéder au dashboard métriques |
| `METRICS_DASHBOARD_REQUIRE_TOKEN` | bool | `true` en prod | — | — | Force l'auth token sur le dashboard |

---

## Balance Dashboard

| Variable | Type | Défaut | Min | Max | Description |
|----------|------|--------|-----|-----|-------------|
| `BALANCE_DASHBOARD_TOKEN` | string | `""` | — | — | Token pour le dashboard de balancing |
| `BALANCE_DASHBOARD_REQUIRE_TOKEN` | bool | `true` | — | — | Force l'auth token (toujours en prod) |
| `BALANCE_DASHBOARD_EVENT_LIMIT` | int | `2000` | 100 | 20 000 | Limite d'événements pour le snapshot |

---

## Difficulté

| Variable | Type | Défaut | Min | Max | Description |
|----------|------|--------|-----|-----|-------------|
| `GLOBAL_DIFFICULTY_BOOST` | float | `0.2` | -0.5 | 0.8 | Boost global de difficulté (0 = neutre, 0.2 = « 20% plus dur ») |

---

## Cache TTLs (server-side SmartCache)

| Variable | Type | Défaut | Min | Max | Description |
|----------|------|--------|-----|-----|-------------|
| `QUESTION_CACHE_TTL_MS` | int | `600 000` (10 min) | 30 000 | 21 600 000 (6h) | TTL du cache de questions |
| `QUESTION_CACHE_STALE_TTL_MS` | int | `7 200 000` (2h) | 30 000 | 86 400 000 (24h) | TTL stale des questions (SWR) |
| `AUTOCOMPLETE_CACHE_TTL_MS` | int | `900 000` (15 min) | 30 000 | 21 600 000 (6h) | TTL du cache autocomplete |
| `AUTOCOMPLETE_CACHE_STALE_TTL_MS` | int | `3 600 000` (1h) | 30 000 | 86 400 000 (24h) | TTL stale autocomplete |
| `TAXON_DETAILS_CACHE_TTL_MS` | int | `86 400 000` (24h) | 60 000 | 1 209 600 000 (14j) | TTL du cache détails taxon |
| `TAXON_DETAILS_CACHE_STALE_TTL_MS` | int | `604 800 000` (7j) | 60 000 | 5 184 000 000 (60j) | TTL stale détails taxon |
| `SIMILAR_SPECIES_CACHE_TTL_MS` | int | `604 800 000` (7j) | 60 000 | 2 592 000 000 (30j) | TTL du cache espèces similaires |
| `SIMILAR_SPECIES_CACHE_STALE_TTL_MS` | int | `2 592 000 000` (30j) | 60 000 | 7 776 000 000 (90j) | TTL stale espèces similaires |
| `SELECTION_STATE_TTL_MS` | int | `1 200 000` (20 min) | 30 000 | 14 400 000 (4h) | TTL des états de sélection (cooldown) |

---

## Cache Limits

| Variable | Type | Défaut | Min | Max | Description |
|----------|------|--------|-----|-----|-------------|
| `MAX_QUESTION_CACHE_ENTRIES` | int | `500` | 50 | 20 000 | Entrées max dans le cache de questions |
| `MAX_TAXON_DETAILS_CACHE_ENTRIES` | int | `12 000` | 1 000 | 200 000 | Entrées max dans le cache taxon details |
| `MAX_SELECTION_STATES` | int | `1 200` | 100 | 20 000 | États de sélection max |
| `MAX_SIMILAR_SPECIES_CACHE_ENTRIES` | int | `5 000` | 200 | 100 000 | Entrées max dans le cache espèces similaires |

---

## Quiz (constantes hardcodées)

Ces valeurs ne sont **pas** configurables via env :

| Constante | Valeur | Description |
|-----------|--------|-------------|
| `quizChoices` | `4` | Nombre de choix par question |
| `lureCount` | `3` | Nombre de leurres (= `quizChoices - 1`) |
| `questionQueueSize` | `3` | Taille du queue de pré-fetch des questions |
| `obsHistoryLimit` | `50` | Historique d'observations récentes (cooldown) |

---

## Round Validation (sécurité)

| Variable | Type | Défaut | Min | Max | Description |
|----------|------|--------|-----|-----|-------------|
| `ROUND_STATE_TTL_MS` | int | `900 000` (15 min) | 30 000 | 3 600 000 (1h) | Durée de validité d'un round signé |
| `ROUND_HMAC_SECRET` | string | `""` | — | — | Secret HMAC-SHA256 pour la signature des rounds |

> **⚠️ En production** : `ROUND_HMAC_SECRET` doit être défini (min 32 caractères). Sans secret, les rounds ne peuvent pas être validés.

---

## Cooldown

| Constante / Variable | Type | Valeur | Description |
|----------------------|------|--------|-------------|
| `cooldownTargetN` | int (hardcodé) | `60` | Nombre d'observations cibles avant cooldown |
| `cooldownTargetMs` | null (hardcodé) | `null` | Cooldown temporel (désactivé) |
| `COOLDOWN_LURE_N` | int | `6` (min 0, max 60) | Nombre de leurres avant cooldown |

---

## Pool Extension (observation fetching)

| Variable | Type | Défaut | Min | Max | Description |
|----------|------|--------|-----|-----|-------------|
| `OBS_POOL_MAX_PAGES` | int | `3` | 1 | 12 | Pages max à charger depuis iNaturalist |
| `OBS_POOL_DISTINCT_TAXA_TARGET` | int | `30` | 4 | 500 | Objectif de taxons distincts par pool |
| `DEGRADE_POOL_MAX_TAXA` | int | `24` | 4 | 200 | Taxons max en mode dégradé |
| `DEGRADE_POOL_MAX_OBS_PER_TAXON` | int | `2` | 1 | 6 | Observations par taxon en mode dégradé |

---

## Lure Thresholds (constantes hardcodées)

| Constante | Valeur | Description |
|-----------|--------|-------------|
| `easyLureMinCloseness` | `0.82` | Closeness LCA minimale pour les leurres en mode Easy |
| `riddleLureMinCloseness` | `0.76` | Closeness LCA minimale pour les leurres en mode Riddle |

---

## Circuit Breaker (iNaturalist, constantes hardcodées)

| Constante | Valeur | Description |
|-----------|--------|-------------|
| `inatCircuitFailureThreshold` | `3` | Échecs consécutifs avant ouverture du circuit |
| `inatCircuitCooldownMs` | `15 000` (15s) | Durée de cooling avant retry |
| `inatCircuitHalfOpenMax` | `1` | Requêtes autorisées en half-open |

---

## Beta KPI Gate (env pour `scripts/check-beta-thresholds.mjs`)

| Variable | Défaut | Description |
|----------|--------|-------------|
| `METRICS_BASE_URL` | `http://localhost:3001` | URL du serveur de métriques |
| `BETA_REQUIRE_72H` | `true` | Requiert 72h de données avant validation |
| `BETA_API_ERROR_RATE_MAX` | `1.5` | Taux d'erreur API max (%) |
| `BETA_CRASH_FREE_MIN` | `99` | Taux crash-free min (%) |
| `BETA_REPORT_SUCCESS_MIN` | `95` | Taux de succès des rapports min (%) |
| `BETA_ACTIVATION_MIN` | `70` | Taux d'activation min (%) |
| `BETA_COMPLETION_MIN` | `65` | Taux de complétion min (%) |
| `BETA_QUIZ_QUESTION_P95_MAX_MS` | `900` | Latence P95 max question (ms) |
| `BETA_QUIZ_SUBMIT_P95_MAX_MS` | `700` | Latence P95 max submit (ms) |
| `BETA_MIN_*` | variés | Échantillons min par KPI (72h et 1h) |
| `BETA_THRESHOLDS_HISTORY_FILE` | `server/data/beta-thresholds-history.json` | Historique des résultats |
| `BETA_SMOKE_PACK_ID` | `world_mammals` | Pack ID pour le smoke test |
| `BETA_SMOKE_LOCALE` | `fr` | Locale pour le smoke test |
