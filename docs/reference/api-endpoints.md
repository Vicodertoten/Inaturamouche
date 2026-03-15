# API Endpoints Reference

> **Source de vérité** — Généré à partir du code source (`server/routes/*.js`, `server/middleware/rateLimiter.js`, `server/config/index.js`, `server/app.js`).

Base URL locale : `http://localhost:3001`  
Production : `https://inaturaquizz.com/api/*` (proxy Netlify → Fly.io)

---

## Conventions globales

### Format d'erreur

Toutes les erreurs suivent le même schéma :

```json
{
  "error": {
    "code": "BAD_REQUEST",
    "message": "Bad request",
    "requestId": "abc123",
    "issues": []
  }
}
```

### Headers de réponse

| Header | Description |
|--------|-------------|
| `X-Request-Id` | Identifiant de corrélation (logs + debug) |
| `RateLimit-Limit` | Quota total de la fenêtre (draft-7) |
| `RateLimit-Remaining` | Requêtes restantes |
| `RateLimit-Reset` | Timestamp de réinitialisation |
| `X-RateLimit-Limit` | _legacy_ — même sémantique |
| `Cache-Control` | Politique de cache HTTP (voir [section ci-dessous](#cache-control-http)) |
| `ETag` | Weak ETag (`W/"..."`) pour validation conditionnelle |

### Authentification

Certains endpoints protégés nécessitent un token Bearer :

```
Authorization: Bearer <token>
```

Le token peut aussi être passé en brut (sans préfixe `Bearer`).

### Locales supportées

`fr` | `en` | `nl` — défaut : `fr`

---

## Rate Limiting

Tous les endpoints sous `/api/*` sont soumis au rate limiter global. Certains endpoints ont un limiter spécifique additionnel.

> Source : `server/middleware/rateLimiter.js`

| Limiter | Scope | Window | Limit | Code d'erreur 429 |
|---------|-------|--------|-------|--------------------|
| `apiLimiter` | `GET\|POST /api/*` (global) | 15 min | 600 | `RATE_LIMIT_EXCEEDED` |
| `quizLimiter` | `GET /api/quiz-question`, `POST /api/quiz/submit` | 1 min | 60 | `QUIZ_RATE_LIMIT_EXCEEDED` |
| `proxyLimiter` | `GET /api/taxon/:id`, `GET /api/taxa`, `GET /api/observations/species_counts`, `GET /api/places`, `GET /api/places/by-id` | 1 min | 120 | `PROXY_RATE_LIMIT_EXCEEDED` |
| `explainLimiter` | `POST /api/quiz/explain` | 1 min | `EXPLAIN_RATE_LIMIT_PER_MINUTE` (défaut: 8) | `EXPLAIN_RATE_LIMIT_EXCEEDED` |
| `explainDailyLimiter` | `POST /api/quiz/explain` | 24 h | `EXPLAIN_DAILY_QUOTA_PER_IP` (défaut: 60) | `EXPLAIN_DAILY_QUOTA_EXCEEDED` |
| `reportsLimiter` | `POST /api/reports` | `REPORTS_RATE_LIMIT_WINDOW_MS` (défaut: 10 min) | `REPORTS_RATE_LIMIT_PER_WINDOW` (défaut: 8) | `REPORT_RATE_LIMIT_EXCEEDED` |

**Note :** `apiLimiter` s'applique **en plus** des limiters spécifiques. L'identification IP utilise `getClientIp()` (trust proxy configuré via `TRUST_PROXY_LIST`). Les headers de rate limit suivent le standard `draft-7`.

---

## Cache-Control HTTP

> Source : `server/app.js` — middleware par route prefix

Le serveur applique un `Cache-Control` automatique selon le chemin de la requête :

| Route pattern | Directive | Explication |
|---------------|-----------|-------------|
| `/api/packs/:id/preview` | `public, max-age=3600, stale-while-revalidate=7200` | Preview images (1h) |
| `/api/packs` | `public, max-age=300, stale-while-revalidate=3600` | Pack catalog (5 min) |
| `/api/taxa/autocomplete` | `public, max-age=120, stale-while-revalidate=600` | Autocomplete (2 min) |
| `/api/taxon/:id` | `public, max-age=60, stale-while-revalidate=300` | Taxon lookup (1 min) |
| `/api/*` (défaut) | `no-store` | Tout autre endpoint |

---

## Endpoints

### Health

| Méthode | Path | Rate Limit | Auth |
|---------|------|-----------|------|
| `GET` | `/healthz` | `apiLimiter` | — |

**Réponse :** `{ "ok": true }`

---

### Packs

| Méthode | Path | Rate Limit | Auth |
|---------|------|-----------|------|
| `GET` | `/api/packs` | `apiLimiter` | — |
| `GET` | `/api/packs/:id/preview` | `apiLimiter` | — |
| `GET` | `/api/packs/home` | `apiLimiter` | — |

#### `GET /api/packs`

Catalogue complet des packs publics.

#### `GET /api/packs/:id/preview`

Aperçu de 4 photos pour un pack donné.

#### `GET /api/packs/home`

Catalogue organisé par sections pour la page d'accueil.

| Query param | Type | Défaut | Description |
|-------------|------|--------|-------------|
| `region` | `world\|belgium\|france\|europe` | — | Région de filtrage |
| `region_override` | string | — | Override de région |
| `recent_pack_ids` | csv | — | IDs des packs récemment joués |
| `section_limit` | number | — | Nombre de packs par section |

---

### Quiz

| Méthode | Path | Rate Limit | Auth |
|---------|------|-----------|------|
| `GET` | `/api/quiz-question` | `apiLimiter` + `quizLimiter` | — |
| `POST` | `/api/quiz/submit` | `apiLimiter` + `quizLimiter` | — |
| `POST` | `/api/quiz/explain` | `apiLimiter` + `explainLimiter` + `explainDailyLimiter` | — |
| `GET` | `/api/quiz/balance-dashboard` | `apiLimiter` | Token conditionnel |

#### `GET /api/quiz-question`

Génère une question de quiz avec 4 choix (1 cible + 3 leurres).

| Query param | Type | Défaut | Description |
|-------------|------|--------|-------------|
| `pack_id` | string | — | ID du pack à utiliser |
| `taxon_ids` | string \| string[] | — | IDs de taxons spécifiques |
| `include_taxa` | string \| string[] | — | Taxons à inclure |
| `exclude_taxa` | string \| string[] | — | Taxons à exclure |
| `place_id` | string \| string[] | — | IDs de lieux iNaturalist |
| `nelat`, `nelng`, `swlat`, `swlng` | number | — | Bounding box |
| `d1`, `d2` | string (ISO date) | — | Période d'observation |
| `seed` | string | — | Seed aléatoire |
| `seed_session` | string | — | Identifiant de session seeded |
| `question_index` | number (0..50) | — | Index de question dans la session |
| `locale` | `fr\|en\|nl` | `fr` | Langue |
| `media_type` | `images\|sounds\|both` | — | Type de média |
| `game_mode` | `easy\|hard` | — | Mode de jeu |
| `client_session_id` | string | — | ID de session client |

> **⚠️ Modes archivés :** Les valeurs `riddle` et `taxonomic` pour `game_mode` renvoient **HTTP 410**.

**Réponse :** question + meta média + `round_id` + `round_signature`.

#### `POST /api/quiz/submit`

Soumet une réponse de manche.

| Body param | Type | Requis | Description |
|------------|------|--------|-------------|
| `round_id` | string (min 8) | ✅ | ID de manche signé |
| `round_signature` | string (min 32) | ✅ | Signature HMAC-SHA256 |
| `round_action` | `answer\|hard_guess` | — | Action jouée |
| `selected_taxon_id` | string \| number | Conditionnel | Requis pour `answer`, `hard_guess` |
| `step_index` | number (0..30) | — | Index d'étape |
| `submission_id` | string | — | Idempotence (deduplicate) |
| `client_session_id` | string | — | ID de session client |
| `seed_session` | string | — | Session seeded |

> **⚠️ Actions archivées :** `taxonomic_select` et `taxonomic_hint` sont validées par Zod mais renvoient **HTTP 410**.

**Réponse :** statut de manche, détails utiles (correct, liens, état hard).

#### `POST /api/quiz/explain`

Demande une explication IA comparant deux espèces.

| Body param | Type | Requis | Description |
|------------|------|--------|-------------|
| `correctId` | number (int, positive) | ✅ | ID du taxon correct |
| `wrongId` | number (int, positive) | ✅ | ID du taxon erroné |
| `locale` | `fr\|en\|nl` | `fr` | Langue de l'explication |
| `focusRank` | string (max 32) | — | Rang taxonomique de focus |

**Contrainte :** `correctId ≠ wrongId`.  
**Réponse :** explication + discriminant + sources (si disponibles).  
**Fallback :** locale `en` si la traduction échoue.

#### `GET /api/quiz/balance-dashboard`

Token requis si `BALANCE_DASHBOARD_REQUIRE_TOKEN=true` (défaut) ou en production.

**Réponse :** snapshot des métriques de balancing en temps réel.

---

### Daily Challenge (archivé)

> **⚠️ Ces endpoints sont archivés et renvoient toujours HTTP 410 (`DAILY_LEADERBOARD_ARCHIVED`).**

| Méthode | Path | Statut |
|---------|------|--------|
| `POST` | `/api/daily/score` | → 410 |
| `GET` | `/api/daily/leaderboard` | → 410 |

---

### Taxa

| Méthode | Path | Rate Limit | Auth |
|---------|------|-----------|------|
| `GET` | `/api/taxa/autocomplete` | `apiLimiter` | — |
| `GET` | `/api/taxon/:id` | `apiLimiter` + `proxyLimiter` | — |
| `GET` | `/api/taxa` | `apiLimiter` + `proxyLimiter` | — |
| `GET` | `/api/observations/species_counts` | `apiLimiter` + `proxyLimiter` | — |

#### `GET /api/taxa/autocomplete`

| Query param | Type | Défaut | Description |
|-------------|------|--------|-------------|
| `q` | string (min 2) | ✅ | Terme de recherche |
| `rank` | string | — | Rang taxonomique |
| `locale` | `fr\|en\|nl` | `fr` | Langue |
| `name_format` | `vernacular\|scientific` | `vernacular` | Format du nom |

#### `GET /api/taxon/:id`

| Query param | Type | Défaut | Description |
|-------------|------|--------|-------------|
| `locale` | `fr\|en\|nl` | — | Langue |

#### `GET /api/taxa`

Lookup batch de taxons.

| Query param | Type | Défaut | Description |
|-------------|------|--------|-------------|
| `ids` | csv (1..100) | ✅ | Identifiants iNaturalist |
| `locale` | `fr\|en\|nl` | — | Langue |

#### `GET /api/observations/species_counts`

Proxy vers iNaturalist `/v1/observations/species_counts`.

| Query param | Type | Défaut | Description |
|-------------|------|--------|-------------|
| `taxon_ids` | string | — | IDs de taxons |
| `include_taxa` | string | — | Taxons à inclure |
| `exclude_taxa` | string | — | Taxons à exclure |
| `place_id` | string | — | ID de lieu |
| `nelat`, `nelng`, `swlat`, `swlng` | number | — | Bounding box |
| `d1`, `d2` | string (ISO) | — | Période |
| `locale` | string | — | Langue |
| `per_page` | number (1..200) | — | Résultats par page |
| `page` | number (1..500) | — | Page |

> **Contrainte :** au moins un filtre requis (`taxon_ids`, `place_id` ou bbox).

---

### Places

| Méthode | Path | Rate Limit | Auth |
|---------|------|-----------|------|
| `GET` | `/api/places` | `apiLimiter` + `proxyLimiter` | — |
| `GET` | `/api/places/by-id` | `apiLimiter` + `proxyLimiter` | — |

#### `GET /api/places`

| Query param | Type | Défaut | Description |
|-------------|------|--------|-------------|
| `q` | string (min 2, max 80) | ✅ | Terme de recherche |
| `per_page` | number (1..25) | — | Résultats par page |

#### `GET /api/places/by-id`

| Query param | Type | Défaut | Description |
|-------------|------|--------|-------------|
| `ids` | csv (0..25) | ✅ | IDs de lieux |

---

### Reports

| Méthode | Path | Rate Limit | Auth |
|---------|------|-----------|------|
| `POST` | `/api/reports` | `apiLimiter` + `reportsLimiter` | Token conditionnel |
| `GET` | `/api/reports` | `apiLimiter` | Token requis |

#### `POST /api/reports`

Soumet un rapport de bug.

| Body param | Type | Requis | Description |
|------------|------|--------|-------------|
| `description` | string (min 5, max 2000) | ✅ | Description du problème |
| `url` | string | — | URL de la page |
| `userAgent` | string | — | User-Agent du navigateur |
| `website` | string | — | Honeypot anti-spam (doit être vide) |

**Auth :** Token Bearer requis uniquement si `REPORTS_REQUIRE_WRITE_TOKEN=true`.

#### `GET /api/reports`

**Auth :** Token `REPORTS_READ_TOKEN` requis.

---

### Metrics (First-party)

| Méthode | Path | Rate Limit | Auth |
|---------|------|-----------|------|
| `POST` | `/api/metrics/events` | `apiLimiter` | — |
| `GET` | `/api/metrics/dashboard` | `apiLimiter` | Token conditionnel |

#### `POST /api/metrics/events`

Ingestion d'événements analytiques (max 50 par requête).

| Body format | Description |
|-------------|-------------|
| Objet unique | Un seul event |
| `{ events: [...] }` | Batch (max 50) |

**Event schema :**

```json
{
  "name": "<event_name>",
  "session_id": "string (opt)",
  "anon_user_id": "string (opt)",
  "ts": 1234567890 (opt),
  "properties": { "key": "value" } (opt)
}
```

**Events validés** (liste stricte — `z.enum`) :

| Nom | Description |
|-----|-------------|
| `app_open` | Ouverture de l'app |
| `play_click` | Clic sur jouer |
| `question_view` | Affichage d'une question |
| `answer_submit` | Soumission d'une réponse |
| `quit_mid_round` | Abandon en cours de manche |
| `round_start` | Début de manche |
| `round_complete` | Fin de manche |
| `report_submit` | Soumission d'un rapport |
| `client_error` | Erreur côté client |
| `api_error` | Erreur API |
| `explanation_open` | Ouverture d'une explication IA |
| `explanation_feedback` | Feedback sur une explication |
| `share_click` | Clic sur partager |

> **⚠️ Attention :** la validation utilise `z.enum(EVENT_NAMES)` — seuls ces 13 noms exacts sont acceptés. Tout autre nom sera rejeté avec `BAD_REQUEST`.

**Headers optionnels :** `X-Client-Session-Id`, `X-Anon-User-Id` (fallback si absents du body).

**Réponse :** `{ accepted: number, success: true }` (HTTP 202)

#### `GET /api/metrics/dashboard`

Token requis si `METRICS_DASHBOARD_REQUIRE_TOKEN=true` (défaut en production).

**Réponse :** dashboard complet des métriques (fenêtres 72h et 1h).

---

## Codes d'erreur serveur

> Source : `server/utils/http.js`, `client/src/services/apiErrors.js`

| Code serveur | Clé client | FR |
|-------------|------------|-----|
| `INTERNAL_SERVER_ERROR` | `internal` | Erreur interne du serveur |
| `BAD_REQUEST` | `bad_request` | Paramètres invalides |
| `NOT_FOUND` | `not_found` | Introuvable |
| `POOL_UNAVAILABLE` | `pool_unavailable` | Aucune observation trouvée... |
| `INAT_UNAVAILABLE` | `inat_unavailable` | Service iNaturalist temporairement indisponible |
| `INAT_TIMEOUT` | `inat_timeout` | Service iNaturalist lent |
| `TAXON_NOT_FOUND` | `taxonomy_not_found` | Taxon non trouvé |
| `ROUND_EXPIRED` | `generic` | Une erreur est survenue... |
| `INVALID_ROUND_SIGNATURE` | `generic` | Une erreur est survenue... |
| `EXPLAIN_RATE_LIMIT_EXCEEDED` | `rate_limited` | Trop de requêtes |
| `EXPLAIN_DAILY_QUOTA_EXCEEDED` | `rate_limited` | Trop de requêtes |
| `REPORT_RATE_LIMIT_EXCEEDED` | `rate_limited` | Trop de requêtes |
| `DAILY_LEADERBOARD_ARCHIVED` | — | (HTTP 410) |

---

## Middleware Chain

> Source : `server/app.js`

Ordre d'exécution des middlewares Express :

1. `trust proxy` — proxy list configurée
2. CORS + `Vary: Origin`
3. Helmet (CSP)
4. Disable `x-powered-by`
5. Weak ETag
6. Compression (gzip/br)
7. JSON body parser (limit: 1 MB)
8. Pino HTTP logging
9. API metrics middleware (enregistrement latence)
10. `apiLimiter` sur `/api/*`
11. Cache-Control par route prefix
12. **Routes** (health → packs → pack-preview → quiz → taxa → places → reports → daily → metrics)
13. 404 handler
14. Error handler global
