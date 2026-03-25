# Systeme de metriques

> Analytics first-party, sans tracker tiers, pour suivre la sante du quiz et l'usage des explications.

## Principes

- aucune dependance a Google Analytics, Mixpanel ou equivalent
- stockage local serveur dans `server/data/metrics-store.json`
- ingestion separee entre evenements API et evenements client
- dashboard calcule a la demande

## Architecture

Fichiers principaux :

- `server/app.js`
- `server/routes/metrics.js`
- `server/services/metricsStore.js`
- `client/src/services/metrics.js`

Flux :

1. middleware API -> evenements backend
2. `POST /api/metrics/events` -> evenements client
3. ecriture debouncee sur disque
4. `GET /api/metrics/dashboard` -> calcul du dashboard

## Evenements client acceptes

Le backend accepte actuellement 23 noms exacts :

- `app_open`
- `play_click`
- `question_view`
- `answer_submit`
- `quit_mid_round`
- `round_start`
- `round_complete`
- `report_submit`
- `client_error`
- `api_error`
- `explanation_open`
- `explanation_brief_requested`
- `explanation_brief_loaded`
- `explanation_brief_fallback`
- `explanation_full_requested`
- `explanation_full_loaded`
- `explanation_source_expand`
- `explanation_confidence`
- `explanation_feedback`
- `explanation_rendered`
- `explanation_render_ignored_stale`
- `explanation_badge_displayed`
- `share_click`

Tout autre nom est rejete avec `BAD_REQUEST`.

## Donnees stockees

### API events

Collectees automatiquement :

- `method`
- `path`
- `status`
- `duration_ms`
- tags normalises utiles au produit

### Client events

Envoyes depuis le frontend avec :

- `name`
- `session_id`
- `anon_user_id`
- `ts`
- `properties`

## Retention

Parametres principaux :

- `METRICS_RETENTION_HOURS`
- `METRICS_MAX_API_EVENTS`
- `METRICS_MAX_CLIENT_EVENTS`

Le store prune les evenements trop anciens et tronque les tableaux si necessaire.

## Dashboard

Le dashboard calcule notamment :

- taux d'erreur API
- activation (`round_start / app_open`)
- completion (`round_complete / round_start`)
- crash-free sessions
- latence P95 de `quiz-question`
- latence P95 de `quiz-submit`
- snapshots par endpoint
- usage et qualite des explications IA

## Auth

L'acces a `GET /api/metrics/dashboard` depend de :

- `METRICS_DASHBOARD_TOKEN`
- `METRICS_DASHBOARD_REQUIRE_TOKEN`
- l'environnement courant

## Ce que la doc ne doit pas faire

- ne pas sous-compter les evenements client: la liste est plus large que le funnel de base
- ne pas presenter ces metrics comme du tracking tiers
- ne pas oublier que les evenements explanation ont plusieurs etapes distinctes
