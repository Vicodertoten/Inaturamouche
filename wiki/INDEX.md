# Documentation iNaturaQuizz

Cette documentation est la source canonique du projet. Elle decrit l'etat actuel du codebase.

## Hierarchie canonique

1. `README.md` : vue produit, demarrage local, liens
2. `wiki/` : point d'entree et guides courts
3. `docs/reference/` : contrats et valeurs exactes
4. `docs/explanation/` : architecture et raisonnement

`docs/archive/` conserve les notes internes et historiques. Ces fichiers ne sont pas canoniques.

## Commencer

1. [GETTING_STARTED.md](GETTING_STARTED.md)
2. [ARCHITECTURE.md](ARCHITECTURE.md)
3. [API_REFERENCE.md](API_REFERENCE.md)

## Guides par domaine

- Backend : [wiki/guides/backend/README.md](guides/backend/README.md)
- Frontend : [wiki/guides/frontend/README.md](guides/frontend/README.md)
- Ops : [wiki/guides/ops/README.md](guides/ops/README.md)

## Documentation détaillée

### Référence (contrats, formats, valeurs exactes)

| Sujet | Fichier |
|---|---|
| Endpoints API | [`docs/reference/api-endpoints.md`](../docs/reference/api-endpoints.md) |
| Configuration & variables d'env | [`docs/reference/configuration.md`](../docs/reference/configuration.md) |
| Scoring & progression | [`docs/reference/scoring-progression.md`](../docs/reference/scoring-progression.md) |
| Packs & données serveur | [`docs/reference/packs-data.md`](../docs/reference/packs-data.md) |
| Données côté client | [`docs/reference/client-data.md`](../docs/reference/client-data.md) |
| Scripts & opérations | [`docs/reference/scripts-ops.md`](../docs/reference/scripts-ops.md) |

### Explication (architecture, flux, raisonnement)

| Sujet | Fichier |
|---|---|
| Architecture globale | [`docs/explanation/architecture.md`](../docs/explanation/architecture.md) |
| Pipeline de questions | [`docs/explanation/question-pipeline.md`](../docs/explanation/question-pipeline.md) |
| Système IA (explications + devinettes) | [`docs/explanation/ai-system.md`](../docs/explanation/ai-system.md) |
| Sécurité des rounds | [`docs/explanation/round-security.md`](../docs/explanation/round-security.md) |
| Stratégie de cache | [`docs/explanation/caching-strategy.md`](../docs/explanation/caching-strategy.md) |
| État frontend | [`docs/explanation/frontend-state.md`](../docs/explanation/frontend-state.md) |
| Système de métriques | [`docs/explanation/metrics-system.md`](../docs/explanation/metrics-system.md) |

## Contribuer

- [CONTRIBUTING.md](../CONTRIBUTING.md)
- [AGENT.md](../AGENT.md)

## Archives

- [docs/archive/README.md](../docs/archive/README.md)
